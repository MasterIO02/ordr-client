import { io, Socket } from "socket.io-client"
import { state } from "./state"
import cleanExit from "./util/clean_exit"
import updateClient from "./update"
import writeCrashReport from "./util/crash_report"
import { config, watchConfig } from "./util/config"
import { ICustomizationSettings, WssClientToServerEvents, WssServerToClientEvents } from "./websocket_types"
import { prepareCommonAssets } from "./renderers/common"
import { updateDiscordPresence } from "./util/discord_presence"
import { abortDanserRender } from "./renderers/danser/render"
import { TKeysFile } from "./util/keys"
import { triggerDanserRenderJob } from "./renderers/danser/job"

let ioClient: Socket<WssServerToClientEvents, WssClientToServerEvents>
let clientId: string
let didConnect: boolean = false // set to true on the first connection to the server

export default async function connectToWebsocket(keys: TKeysFile, version: number) {
    clientId = keys.client_id
    let socketUrl = config.dev ? config.dev.server.websocket : "https://ordr-clients.issou.best"
    const socket = io(socketUrl, { reconnectionDelay: 10000, reconnectionDelayMax: 10000 })
    ioClient = socket.connect()

    let customization = config.customization

    setTimeout(() => {
        if (!ioClient.connected && !didConnect) {
            console.log("Cannot connect to the o!rdr server. Trying to connect...")
        }
    }, 2000)

    ioClient.on("connect", () => {
        console.log("Connected to the o!rdr server!")
        ioClient.emit("id", {
            // TODO next ver: rework whole authentication process (handle multi-renderers, etc)
            id: clientId,
            version: version,
            usingOsuApi: keys.osu.oauth_client_id && keys.osu.oauth_client_secret ? true : false,
            motionBlurCapable: config.capabilities.danser.motion_blur,
            uhdCapable: config.capabilities.danser.uhd,
            isRendering: state.isWorking,
            encodingWith: config.encoder,
            customization: {
                textColor: customization.text_color,
                backgroundType: customization.background_type
            }
        })

        if (!didConnect) {
            // watch for config changes once we're connected to the o!rdr server to avoid trying to send updated to the server when we're not connected to it
            watchConfig()
        }

        didConnect = true
    })

    ioClient.on("disconnect", () => {
        console.log("Disconnected from the server!")
    })

    ioClient.on("job", async data => {
        state.isWorking = true
        updateDiscordPresence("Working", false)

        await prepareCommonAssets()

        if (data.job === "DANSER_RENDER") {
            const jobState = await triggerDanserRenderJob(data.jobData)
            endJob(jobState.success)
        } else {
            console.error("Got an unknown job type, exiting!")
            cleanExit()
        }
    })

    ioClient.on("cool_message", (message, exit) => {
        console.log(`The o!rdr server says: ${message}`)
        if (exit) cleanExit()
    })

    ioClient.on("invalid_version", data => {
        console.log("This version of the client is too old!")
        ioClient.disconnect()
        updateClient(data.expectedVersion)
    })

    ioClient.on("abort_render", async () => {
        console.log("Received an abort from the o!rdr server, cancelling current job.")
        abortDanserRender("REQUESTED")
    })

    ioClient.on("connect_error", err => {
        console.log(`Websocket connection error: ${err.message}`)
    })
}

/**
 * @description Run what we have to run when a job ends, whether it succeeded or failed
 * @param success Did the job succeed? Defaults to false because this function should be called in a SINGLE line with success = true
 */
async function endJob(success: boolean = false) {
    // waiting 2s before setting isWorking to false
    // if the user spams CTRL+C and doesn't wait for the server acknowledgement ("you earned x e-sous"), the render will be reset
    // TODO next ver: server should send a confirmation message that the render is completely finished and set isWorking to false when we receive this message
    setTimeout(() => (state.isWorking = false), 2000)

    updateDiscordPresence("Idle", success)
}

export function disconnectWebsocket() {
    if (ioClient) ioClient.disconnect()
}

// TODO next ver: separate progression in 3 events, "error", "progress", "state"
export function sendProgression(data: string) {
    ioClient.emit("progression", { progress: data })
}

export async function handlePanic(data: string) {
    // send the crash to the o!rdr server
    ioClient.emit("panic", { crash: "danser crash: " + data })
    await writeCrashReport(data, "danser")
}

export function emitCustomizationChange(customization: ICustomizationSettings) {
    ioClient.emit("customization_change", customization)
}
