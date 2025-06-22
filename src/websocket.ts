import { io, Socket } from "socket.io-client"
import { state } from "./state"
import cleanExit from "./util/clean_exit"
import updateClient from "./update"
import writeCrashReport from "./util/crash_report"
import { config } from "./util/config"
import { WssClientToServerEvents, WssServerToClientEvents } from "./websocket_types"
import { prepareCommonAssets, prepareRenderAssets } from "./renderers/common"
import { updateDiscordPresence } from "./util/discord_presence"
import { prepareDanserRender } from "./renderers/danser/prepare"
import renderDanserVideo, { abortDanserRender } from "./renderers/danser/render"
import uploadVideo from "./util/upload_video"
import fs from "fs"

let ioClient: Socket<WssServerToClientEvents, WssClientToServerEvents>
let clientId: string

export default async function connectToWebsocket(keyId: string, version: number) {
    clientId = keyId
    let socketUrl = config.dev ? config.dev.server.websocket : "https://ordr-clients.issou.best"
    const socket = io(socketUrl, { reconnectionDelay: 10000, reconnectionDelayMax: 10000 })
    ioClient = socket.connect()

    let customization = config.customization

    setTimeout(() => {
        if (!ioClient.connected) {
            console.log("Cannot connect to the o!rdr server. Trying to connect...")
        }
    }, 2000)

    ioClient.on("connect", () => {
        console.log("Connected to the o!rdr server!")
        ioClient.emit("id", {
            id: keyId,
            version: version,
            // TODO: test that these values are correctly sent to the server
            usingOsuApi: config.auth.osu.client_id && config.auth.osu.client_secret ? true : false,
            motionBlurCapable: config.capabilities.danser.motion_blur,
            uhdCapable: config.capabilities.danser.uhd,
            isRendering: state.isWorking,
            encodingWith: config.encoder,
            customization: {
                // TEMP: sending as camelCase to stay compatible with the v26 client behavior with the server, this whole identification process needs to be reworked
                textColor: customization.text_color,
                backgroundType: customization.background_type
            }
        })
    })

    ioClient.on("disconnect", () => {
        console.log("Disconnected from the server!")
    })

    // TODO next ver: rework incoming data and rename to "jobs", add job name in the job data (see state job types)
    ioClient.on("data", async data => {
        state.isWorking = true
        updateDiscordPresence("Working", false)

        // TODO next ver: all errors should be sent in another event, not "progression"

        // we know renders are always using danser right now
        await prepareCommonAssets()
        let preparationResult = await prepareRenderAssets(data)
        if (!preparationResult.success) {
            ioClient.emit("progression", {
                id: clientId,
                progress: preparationResult.error ?? "UNKNOWN"
            })
            endJob()
            return
        }

        await prepareDanserRender(data)
        console.log("Finished to prepare danser. Starting the render now.")

        let renderResult = await renderDanserVideo(data)
        // delete the replay we just rendered, no matter if the render failed or not
        fs.rmSync(`data/replays/${data.renderID}.osr`)
        if (!renderResult.success) {
            ioClient.emit("progression", {
                id: clientId,
                progress: renderResult.error ? `DANSER_${renderResult.error}` : "UNKNOWN"
            })
            endJob()
            if (renderResult.exit) await cleanExit() // if the error is too serious, we're exiting the client
            return
        }

        console.log("Uploading video.")
        ioClient.emit("progression", { id: clientId, progress: "UPLOADING" })
        let uploadResult = await uploadVideo(data)
        if (!uploadResult.success) {
            ioClient.emit("progression", {
                id: clientId,
                progress: uploadResult.error ?? "UNKNOWN"
            })
            endJob()
            return
        }
        ioClient.emit("progression", { id: clientId, progress: "Done." })

        console.log("Video sent successfully. Waiting for a new task.")

        endJob()
    })

    ioClient.on("cool_message", data => {
        console.log(`The o!rdr server says: ${data.message}`)
        if (data.exit) cleanExit()
    })

    ioClient.on("version_too_old", () => {
        console.log("This version of the client is too old!")
        ioClient.disconnect()
        updateClient()
    })

    ioClient.on("abort_render", async () => {
        console.log("Received an abort from the o!rdr server, cancelling current job.")
        abortDanserRender("REQUESTED")
    })

    ioClient.on("connect_error", err => {
        console.log(`Websocket connection error: ${err.message}`)
    })

    // TODO: reimplement config change watch for customization update
    /*let lastConfig = await readConfig()
    fs.watchFile(process.cwd() + "/config.json", { interval: 1000 }, async () => {
        let newConfig = await readConfig()
        if (lastConfig.customization.textColor === newConfig.customization.textColor && lastConfig.customization.backgroundType === newConfig.customization.backgroundType) return
        console.log("Detected change in the config file, telling changes to the server.")
        customization = config.customization
        ioClient.emit("customization_change", newConfig.customization)
        lastConfig = newConfig
    })*/
}

/**
 * @description Run what we have to run when a job ends, whether it succeeded or failed
 */
async function endJob() {
    // waiting 2s before setting isWorking to false
    // if the user spams CTRL+C and doesn't wait for the server acknowledgement ("you earned x e-sous"), the render will be reset
    // TODO next ver: server should send a confirmation message that the render is completely finished and set isWorking to false when we receive this message
    setTimeout(() => (state.isWorking = false), 2000)

    updateDiscordPresence("Idle", false)
}

export async function disconnectWebsocket() {
    if (ioClient) ioClient.disconnect()
}

// TODO next ver: we shouldn't send the ID anymore after the first connection! server needs to use the socket id to track clients
export async function sendProgression(data: string) {
    ioClient.emit("progression", {
        id: clientId,
        progress: data
    })
}

export async function handlePanic(data: string) {
    // send the crash to the o!rdr server
    ioClient.emit("panic", {
        id: clientId,
        crash: "danser crash: " + data
    })
    await writeCrashReport(data, "danser")
}
