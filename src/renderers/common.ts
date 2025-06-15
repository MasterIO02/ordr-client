import fs from "fs"
import downloadFile from "../util/download_file"
import extractFile from "../util/extract_file"
import { IJobData } from "../websocket_types"
import config from "../../config.json"

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
export async function prepareRenderAssets(jobData: IJobData): Promise<{ success: true } | { success: false; error: TPreparationError }> {
    // download the skin
    const localSkinPath = `data/skins`
    if (jobData.skin !== "default") {
        if (jobData.customSkin) {
            // custom skins are saved with CUSTOM_ at the start of the skin filename
            if (fs.existsSync(`data/skins/CUSTOM_${jobData.skin}`)) {
                console.log(`Custom skin #${jobData.skin} is present.`)
            } else {
                const url = config.dev ? `${config.dev.server.shortlink}/skin/clientdownload/${jobData.skin}` : `https://link.issou.best/skin/clientdownload/${jobData.skin}`

                // TODO: test that failure works
                let customSkinFilename = `CUSTOM_${jobData.skin}.osk`
                let downloadedSkin = await downloadFile({ url, to: localSkinPath, filename: customSkinFilename, exitOnFail: false })
                if (!downloadedSkin) return { success: false, error: "DOWNLOAD_SKIN" }
                await extractFile({ input: `${localSkinPath}/${customSkinFilename}`, output: `data/skins/CUSTOM_${jobData.skin}` })
                console.log(`Successfully downloaded custom skin #${jobData.skin}.`)
            }
        } else {
            // not a custom skin (deprecated soon)
            if (fs.existsSync(`data/skins/${jobData.skin}`)) {
                console.log(`Skin ${jobData.skin} is present.`)
            } else {
                let urlServer = ""
                if (config.relay === "us") urlServer = "-us"

                let skinFilename = `${jobData.skin}.osk`
                const url = `https://dl${urlServer}.issou.best/ordr/skins/${skinFilename}`
                let downloadedSkin = await downloadFile({ url, to: localSkinPath, exitOnFail: false })
                if (!downloadedSkin) return { success: false, error: "DOWNLOAD_SKIN" }
                await extractFile({ input: `${localSkinPath}/${skinFilename}`, output: `data/skins/${jobData.skin}` })
            }
        }
    }

    // download the replay
    let downloadedReplay = await downloadFile({ url: jobData.replayFilePath, to: "data/replays", filename: `${jobData.renderID}.osr` })
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

        let downloadedBeatmapset = await downloadFile({ url: jobData.mapLink, to: "data/songs", filename: `${beatmapsetId}.osz` })
        if (!downloadedBeatmapset) return { success: false, error: "DOWNLOAD_BEATMAPSET" }
    }

    return { success: true }

    // TODO: after this we have to run what's in the settingsGenerator for danser
}
