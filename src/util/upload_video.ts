import { config } from "../util/config"
import { IJobData } from "../websocket_types"
import { getKeys } from "./keys"
import fs, { openAsBlob } from "fs"

export default async function uploadVideo(jobData: IJobData): Promise<{ success: true } | { success: false; error: "WHAT_KEY" | "FAILED_UPLOAD" }> {
    let uploadUrl
    if (config.dev) {
        uploadUrl = config.dev.server.api + "/upload"
    } else {
        uploadUrl = config.relay === "direct" ? "https://apis.issou.best/ordr/upload" : `https://ordr-relay-${config.relay}.issou.best/upload`
    }

    let keys = await getKeys()
    if (!keys) return { success: false, error: "WHAT_KEY" }

    const videoBlob = await openAsBlob(`data/videos/render${jobData.renderID}.mp4`, { type: "application/octet-stream" })

    const formData = new FormData()
    formData.append("rendererId", keys.client_id)
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

    return { success: true }
}
