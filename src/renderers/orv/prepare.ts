import fs from "fs"
import path from "path"
import { spawn } from "child_process"
import { TStartupData } from "../../util/startup_data"
import validateFiles from "../../util/validate_files"
import updateORV from "./update"
import downloadFile from "../../util/download_file"
import { verifyRealmBeatmap } from "./render"
import computeMd5 from "../../util/checksum"
import { config } from "../../util/config"
import { SKIN_PREVIEW_GAMEMODES } from "../../websocket_types"

const ORV_EXEC = path.resolve(process.platform === "win32" ? "bins/orv/osu-replay-viewer.exe" : "bins/orv/osu-replay-viewer")

/**
 * @description we need to keep track of the md5 hashes of the imported beatmapsets for skin preview generation: lazer deletes the original files on import and stores them itself
 */
const MARKER_PATH = "data/preview-maps-imported.json"

/**
 * @description the md5 hashes of the BEATMAP (= .osu, not the whole .osz) so we can tell lazer to use a specific beatmap to run screenshot of
 */
export let previewMapMd5s: Record<string, string> = {}

/**
 * @description Prepare ORV (osu-replay-viewer) to be used with the client (check version, download binaries...), ran once on client startup
 */
export async function prepareORVStartup(startupData: TStartupData) {
    if (!fs.existsSync("bins/orv")) fs.mkdirSync("bins/orv")

    const validatedFiles = await validateFiles(startupData.validateFiles, "orv")

    if (!validatedFiles) {
        console.log("The version of osu-replay-viewer is too old or corrupted, updating now")
        await updateORV(startupData.orvVersion)
    }

    // store beatmap MD5s for later use by job.ts (ORV Realm lookup)
    for (const gamemode of SKIN_PREVIEW_GAMEMODES) {
        previewMapMd5s[gamemode] = startupData.previewMaps[gamemode].beatmapMd5
    }

    // ensure ORV data directory exists before importing maps (Realm lives here)
    if (!fs.existsSync("data/orv-data")) fs.mkdirSync("data/orv-data", { recursive: true })

    await downloadAndImportPreviewMaps(startupData.previewMaps)
    generateORVConfig()
}

/**
 * @description Download preview map .osz files, verify integrity, and import them into ORV's Realm database. Uses a marker file to skip maps that are already up to date
 */
async function downloadAndImportPreviewMaps(previewMaps: TStartupData["previewMaps"]) {
    // read existing marker to detect which maps are already imported
    let importedMaps: Record<string, string> = {}
    if (fs.existsSync(MARKER_PATH)) {
        try {
            importedMaps = JSON.parse(fs.readFileSync(MARKER_PATH, { encoding: "utf-8" }))
        } catch {
            importedMaps = {}
        }
    }

    for (const gamemode of SKIN_PREVIEW_GAMEMODES) {
        const map = previewMaps[gamemode]

        // check if this exact map version is already imported (marker matches server's fileMd5)
        if (importedMaps[gamemode] === map.fileMd5) {
            // also verify the beatmap actually exists in Realm (defensive against corrupted Realm)
            const inRealm = await verifyRealmBeatmap(map.beatmapMd5)
            if (inRealm) {
                if (config.debug) console.log(`Preview map for ${gamemode} is up to date and in Realm.`)
                continue
            }
            console.log(`Preview map for ${gamemode} marker is valid but beatmap missing from Realm, re-importing.`)
        }

        // .osz is downloaded as a temporary file in data/ and deleted after import by lazer itself
        const mapPath = path.resolve(`data/${gamemode}_preview.osz`)

        // download the .osz
        console.log(`Downloading preview map for ${gamemode}...`)
        await downloadFile({ url: map.url, to: "data", filename: `${gamemode}_preview.osz` })

        // verify downloaded file integrity
        const downloadedMd5 = await computeMd5(mapPath)
        if (!downloadedMd5 || downloadedMd5 !== map.fileMd5) {
            console.error(`Preview map for ${gamemode} failed integrity check after download (expected ${map.fileMd5}, got ${downloadedMd5}). Aborting startup.`)
            process.exit(1)
        }

        // import the map into ORV's Realm
        console.log(`Importing preview map for ${gamemode} into ORV...`)
        const importSuccess = await new Promise<boolean>(resolve => {
            const proc = spawn(ORV_EXEC, ["--yes", "--import-beatmap", mapPath, "--data-path", `${process.cwd()}/data/orv-data`], { cwd: "bins/orv", stdio: ["ignore", "pipe", "pipe"] })

            proc.stdout?.on("data", (data: Buffer) => {
                if (config.debug) console.debug(data.toString())
            })
            proc.stderr?.on("data", (data: Buffer) => {
                if (config.debug) console.debug(data.toString())
            })

            proc.on("close", code => {
                if (code !== 0) {
                    console.error(`Failed to import preview map for ${gamemode} (exit code ${code})`)
                    resolve(false)
                    return
                }
                resolve(true)
            })

            proc.on("error", err => {
                console.error(`Error importing preview map for ${gamemode}:`, err)
                resolve(false)
            })
        })

        if (!importSuccess) {
            console.error(`Aborting startup: could not import preview map for ${gamemode}.`)
            process.exit(1)
        }

        // verify the beatmap landed in Realm
        const verified = await verifyRealmBeatmap(map.beatmapMd5)
        if (!verified) {
            console.error(`Preview map for ${gamemode} failed Realm verification after import. Aborting startup.`)
            process.exit(1)
        }

        // update marker
        importedMaps[gamemode] = map.fileMd5
        fs.writeFileSync(MARKER_PATH, JSON.stringify(importedMaps, null, 2), { encoding: "utf-8" })

        console.log(`Preview map for ${gamemode} imported and verified.`)
    }
}

/**
 * @description Generate the ORV JSON config file at data/orv-config.json with 4K screenshot settings
 * Hardcoded while rendering video gameplay isn't implemented
 */
function generateORVConfig() {
    const orvConfig = {
        record_options: {
            fps: 60,
            resolution: "3840x2160",
            renderer: "Auto"
        },
        ffmpeg_options: {
            mode: "Pipe",
            libraries_path: "",
            // these hardcoded values are not being used since we only use ORV for screenshotting for now (outputs PNGs)
            ffmpeg_executable: "ffmpeg",
            video_encoder: "libx264",
            video_encoder_preset: "slow",
            video_encoder_bitrate: "10M",
            use_cuda_if_possible: false
        },
        output_options: {
            pixel_format: "RGB",
            yuv_color_space: "BT709"
        },
        game_settings: {
            skip_intro: false,
            show_scoreboard: false,
            show_mods: false,
            background_dim: 1,
            show_storyboard_or_video: false,
            use_beatmap_hitsounds: false,
            use_beatmap_skin: false,
            use_beatmap_colors: false,
            music_volume: 0.0,
            effects_volume: 0.0,
            master_volume: 0.0
        }
    }

    fs.writeFileSync("data/orv-data/orv-config.json", JSON.stringify(orvConfig, null, 2), { encoding: "utf-8" })
}
