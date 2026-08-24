import cleanExit from "../../util/clean_exit"
import uploadVideo from "../../util/upload_video"
import { emitJobError, emitJobState } from "../../websocket"
import { TJobPreparationError, TDanserRenderJobData, TVideoRenderJobData } from "../../websocket_types"
import { buildSkinFolderName } from "../common"
import { prepareDanserRender } from "./prepare"
import renderDanserVideo from "./render"
import downloadFile from "../../util/download_file"
import extractFile from "../../util/extract_file"
import { config } from "../../util/config"
import fs from "fs"

/**
 * @description Download and extract a custom skin for danser. The .osk is deleted after extraction.
 * Returns the extracted skin folder name (for danser config).
 */
async function downloadSkin(skinId: number, skinVersion: number, skinMinorVersion: number): Promise<{ success: true; skinFolder: string } | { success: false; error: TJobPreparationError }> {
    const skinFolder = buildSkinFolderName(skinId, skinVersion, skinMinorVersion)
    const skinFolderPath = `data/skins/${skinFolder}`

    if (fs.existsSync(skinFolderPath)) {
        console.log(`The custom skin #${skinId} is present (extracted).`)
        return { success: true, skinFolder }
    }

    // remove any existing version of this skin before downloading
    const skinsDir = fs.readdirSync("data/skins")
    const versionRegex = new RegExp(`^CUSTOM_${skinId}(_v\\d+(\\.\\d+)?)?$`)

    for (const entry of skinsDir) {
        if (entry.match(versionRegex)) {
            fs.rmSync(`data/skins/${entry}`, { recursive: true, force: true })
            console.log(`Removed old existing custom skin #${skinId} (${entry}).`)
        }
    }

    // download the .osk
    const url = config.dev ? `${config.dev.server.shortlink}/skin/download/${skinId}/renderer` : `https://link.issou.best/skin/download/${skinId}/renderer`
    const oskFilename = `${skinFolder}.osk`

    let downloadedSkin = await downloadFile({ url, to: "data/skins", filename: oskFilename, exitOnFail: false })
    if (!downloadedSkin) return { success: false, error: "DOWNLOAD_SKIN" }

    // extract the .osk, extractFile deletes the input by default
    await extractFile({ input: `data/skins/${oskFilename}`, output: skinFolderPath })

    console.log(`Successfully downloaded and extracted custom skin #${skinId}.`)
    return { success: true, skinFolder }
}

/**
 * @description Prepare assets when a render job comes in (download skin, beatmap, replay)
 */
async function prepareDanserRenderAssets(jobData: TVideoRenderJobData): Promise<{ success: true; skinFolderName: string | null } | { success: false; error: TJobPreparationError }> {
    let expectedSkinFolder: string | null = null

    // if skin is 0, then it's default for danser
    if (jobData.skin !== 0) {
        let skinResult = await downloadSkin(jobData.skin, jobData.skinVersion, jobData.skinMinorVersion)
        if (!skinResult.success) return skinResult
        expectedSkinFolder = skinResult.skinFolder
    }

    // download the replay
    let downloadedReplay = await downloadFile({ url: jobData.replayUrl, to: "data/replays", filename: `${jobData.renderID}.osr`, exitOnFail: false })
    if (!downloadedReplay) return { success: false, error: "DOWNLOAD_REPLAY" }

    // download the beatmap
    let beatmapsetId = jobData.mapUrl.split("/").pop()?.split(".")[0]
    if (!beatmapsetId) return { success: false, error: "DOWNLOAD_BEATMAPSET" }

    // no extension in the existsSync because the beatmapset should be a folder after danser imports it
    if (fs.existsSync(`data/songs/${beatmapsetId}`) && !jobData.needToRedownload) {
        console.log(`The beatmapset ${beatmapsetId} is present.`)
    } else {
        if (jobData.needToRedownload) console.log("A beatmapset update is available.")

        let downloadedBeatmapset = await downloadFile({ url: jobData.mapUrl, to: "data/songs", filename: `${beatmapsetId}.osz`, exitOnFail: false })
        if (!downloadedBeatmapset) return { success: false, error: "DOWNLOAD_BEATMAPSET" }
    }

    return { success: true, skinFolderName: expectedSkinFolder }
}

export async function triggerDanserRenderJob(jobData: TVideoRenderJobData & TDanserRenderJobData): Promise<{ success: boolean }> {
    let preparationResult = await prepareDanserRenderAssets(jobData)
    if (!preparationResult.success) {
        emitJobError({ source: "GENERAL", error: preparationResult.error })
        console.log("Waiting for a new job.")
        return { success: false }
    }

    await prepareDanserRender(jobData, preparationResult.skinFolderName)
    console.log("Finished to prepare danser. Starting the render now.")

    let renderResult = await renderDanserVideo(jobData)

    // delete the replay we just rendered, no matter if the render failed or not
    fs.rmSync(`data/replays/${jobData.renderID}.osr`)

    if (!renderResult.success) {
        emitJobError({ source: "DANSER", error: renderResult.error })
        if (renderResult.exit) await cleanExit() // if the error is too serious, we're exiting the client
        console.log("Waiting for a new job.")
        return { success: false }
    }

    console.log("Uploading video.")

    emitJobState("UPLOADING")

    let uploadResult = await uploadVideo(jobData)
    if (!uploadResult.success) {
        emitJobError({ source: "GENERAL", error: uploadResult.error })
        console.log("Waiting for a new job.")
        return { success: false }
    }

    emitJobState("DONE")
    console.log("Video rendered and uploaded successfully! Waiting for a new job.")
    return { success: true }
}
