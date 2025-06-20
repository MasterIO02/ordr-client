import config from "../../config.json"
import { IJobData } from "../websocket_types"
import { getId } from "./key"
import fs, { openAsBlob } from "fs"

export default async function uploadVideo(jobData: IJobData): Promise<{ success: true } | { success: false; error: "WHAT_KEY" | "FAILED_UPLOAD" }> {
    let uploadUrl
    if (config.dev) {
        uploadUrl = config.dev.server.api + "/upload"
    } else {
        uploadUrl = config.relay === "direct" ? "https://apis.issou.best/ordr/upload" : `https://ordr-relay-${config.relay}.issou.best/upload`
    }

    let key = await getId()
    if (!key) return { success: false, error: "WHAT_KEY" }

    const videoBlob = await openAsBlob(`data/videos/render${jobData.renderID}.mp4`, { type: "application/octet-stream" })

    const formData = new FormData()
    formData.append("rendererId", await getId())
    formData.append("videoFile", videoBlob)

    try {
        let response = await fetch(uploadUrl, {
            method: "POST",
            body: formData
        })

        if (!response.ok) {
            console.error(`Encountered status code ${response.status} while trying to upload video`)
            return { success: false, error: "FAILED_UPLOAD" }
        }
    } catch (err) {
        console.error(`An error occured while trying to upload the video`, err)
        return { success: false, error: "FAILED_UPLOAD" }
    }

    // delete the video we just uploaded
    fs.rmSync(`data/videos/render${jobData.renderID}.mp4`)

    // delete the replay we just rendered
    fs.rmSync(`data/replays/${jobData.renderID}.osr`)

    return { success: true }
}
