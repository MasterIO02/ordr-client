import cleanExit from "../../util/clean_exit"
import uploadVideo from "../../util/upload_video"
import { sendProgression } from "../../websocket"
import { TDanserRenderJobData, TVideoRenderJobData } from "../../websocket_types"
import { prepareRenderAssets } from "../common"
import { prepareDanserRender } from "./prepare"
import renderDanserVideo from "./render"
import fs from "fs"

export async function triggerDanserRenderJob(jobData: TVideoRenderJobData & TDanserRenderJobData): Promise<{ success: boolean }> {
    let preparationResult = await prepareRenderAssets(jobData)
    if (!preparationResult.success) {
        sendProgression(preparationResult.error)
        console.log("Waiting for a new job.")
        return { success: false }
    }

    await prepareDanserRender(jobData, preparationResult.skinFolderName)
    console.log("Finished to prepare danser. Starting the render now.")

    let renderResult = await renderDanserVideo(jobData)

    // delete the replay we just rendered, no matter if the render failed or not
    fs.rmSync(`data/replays/${jobData.renderID}.osr`)

    if (!renderResult.success) {
        sendProgression(`DANSER_${renderResult.error}`)
        if (renderResult.exit) await cleanExit() // if the error is too serious, we're exiting the client
        console.log("Waiting for a new job.")
        return { success: false }
    }

    console.log("Uploading video.")
    sendProgression("UPLOADING")

    let uploadResult = await uploadVideo(jobData)
    if (!uploadResult.success) {
        sendProgression(uploadResult.error)
        console.log("Waiting for a new job.")
        return { success: false }
    }

    sendProgression("DONE")
    console.log("Video rendered and uploaded successfully! Waiting for a new job.")
    return { success: true }
}
