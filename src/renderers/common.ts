import fs from "fs"
import downloadFile from "../util/download_file"
import extractFile from "../util/extract_file"
import { IJobData } from "../websocket_types"
import { config } from "../util/config"

// TODO: all fs calls to fs/promises

/**
 * @description Prepare common assets for all renderers at client startup and for every incoming job
 */
export async function prepareCommonAssets(): Promise<boolean> {
    // checking for custom folder paths at every run to make sure they're all there (user could have deleted something)
    if (!fs.existsSync("data/songs")) fs.mkdirSync("data/songs", { recursive: true })
    if (!fs.existsSync("data/skins")) fs.mkdirSync("data/skins", { recursive: true })
    if (!fs.existsSync("data/replays")) fs.mkdirSync("data/replays", { recursive: true })
    if (!fs.existsSync("data/videos")) fs.mkdirSync("data/videos", { recursive: true })

    // downloading the default fallback skin
    if (!fs.existsSync("data/skins/default_fallback")) {
        await downloadFile({ url: "https://dl.issou.best/ordr/default_fallback_skin.zip", to: "data/skins", filename: "default_fallback_skin.zip" })
        await extractFile({ input: "data/skins/default_fallback_skin.zip", output: "data/skins/default_fallback" })
    }

    return true
}

export type TPreparationError = "DOWNLOAD_SKIN" | "DOWNLOAD_REPLAY" | "DOWNLOAD_BEATMAPSET"

/**
 * @description Prepare assets when a render job comes in (download skin, beatmap, replay)
 */
export async function prepareRenderAssets(jobData: IJobData): Promise<{ success: true; skinFolderName: string | null } | { success: false; error: TPreparationError }> {
    // download the skin
    const localSkinPath = `data/skins`
    let expectedSkinFolder: string | null = null // the name of the (custom) skin folder we should have to run the render

    if (jobData.skin !== "default" && jobData.customSkin) {
        // custom skins are saved with CUSTOM_ at the start of the skin filename
        const skinMajor = jobData.customSkinVersion || 0
        const skinMinor = jobData.customSkinMinorVersion || 0
        const versionSuffix = skinMajor > 0 ? `_v${skinMajor}.${skinMinor}` : ""
        expectedSkinFolder = `CUSTOM_${jobData.skin}${versionSuffix}`

        if (fs.existsSync(`data/skins/${expectedSkinFolder}`)) {
            console.log(`The custom skin #${jobData.skin}${versionSuffix ? ` (${versionSuffix.slice(1)})` : ""} is present.`)
        } else {
            // remove any existing version of this skin before downloading
            const skinsDir = fs.readdirSync(localSkinPath)
            const versionRegex = new RegExp(`^CUSTOM_${jobData.skin}(_v\\d+(\\.\\d+)?)?$`)

            for (const entry of skinsDir) {
                if (entry.match(versionRegex)) {
                    fs.rmSync(`${localSkinPath}/${entry}`, { recursive: true, force: true })
                    console.log(`Removed old existing custom skin #${jobData.skin} (${entry}).`)
                }
            }

            const url = config.dev ? `${config.dev.server.shortlink}/skin/download/${jobData.skin}/renderer` : `https://link.issou.best/skin/download/${jobData.skin}/renderer`

            let customSkinFilename = `${expectedSkinFolder}.osk`
            let downloadedSkin = await downloadFile({ url, to: localSkinPath, filename: customSkinFilename, exitOnFail: false })
            if (!downloadedSkin) return { success: false, error: "DOWNLOAD_SKIN" }
            await extractFile({ input: `${localSkinPath}/${customSkinFilename}`, output: `data/skins/${expectedSkinFolder}` })
            console.log(`Successfully downloaded custom skin #${jobData.skin}${versionSuffix ? ` (${versionSuffix})` : ""}.`)
        }
    }

    // download the replay
    let downloadedReplay = await downloadFile({ url: jobData.replayFilePath, to: "data/replays", filename: `${jobData.renderID}.osr`, exitOnFail: false })
    if (!downloadedReplay) return { success: false, error: "DOWNLOAD_REPLAY" }

    // download the beatmap
    let beatmapsetId = jobData.mapLink.split("/").pop()?.split(".")[0]
    if (!beatmapsetId) return { success: false, error: "DOWNLOAD_BEATMAPSET" }

    // no extension in the existsSync because the beatmapset should be a folder after danser imports it
    // will have to see if other renderers (osu!lazer?) do the same
    if (fs.existsSync(`data/songs/${beatmapsetId}`) && !jobData.needToRedownload) {
        // we have the beatmapset, and we don't need to redownload it
        console.log(`The beatmapset ${beatmapsetId} is present.`)
    } else {
        if (jobData.needToRedownload) console.log("A beatmapset update is available.")

        let downloadedBeatmapset = await downloadFile({ url: jobData.mapLink, to: "data/songs", filename: `${beatmapsetId}.osz`, exitOnFail: false })
        if (!downloadedBeatmapset) return { success: false, error: "DOWNLOAD_BEATMAPSET" }
    }

    return { success: true, skinFolderName: expectedSkinFolder }
}
