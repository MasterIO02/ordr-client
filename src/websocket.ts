import { io, Socket } from "socket.io-client"
import { state } from "./state"
import cleanExit from "./util/clean_exit"
import updateClient from "./update"
import writeCrashReport from "./util/crash_report"
import { config, watchConfig } from "./util/config"
import { ICustomizationSettings, TJobErrorEventRequest, TJobPreparationError, TJobState, TJobUploadError, WssClientToServerEvents, WssServerToClientEvents } from "./websocket_types"
import { prepareCommonAssets } from "./renderers/common"
import { updateDiscordPresence } from "./util/discord_presence"
import { abortDanserRender, TDanserError } from "./renderers/danser/render"
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
        ioClient.emit("auth", {
            id: clientId,
            version: version,
            usingOsuApi: Boolean(keys.osu.oauth_client_id && keys.osu.oauth_client_secret),
            encodingWith: config.encoder,
            isRendering: state.isWorking,
            capabilities: config.capabilities,
            acceptJobs: config.accept_jobs,
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

export function emitJobState(state: TJobState) {
    ioClient.emit("job_state", state)
}

export function emitJobProgress(percentage: number) {
    ioClient.emit("job_progress", percentage)
}

export async function emitJobError(data: TJobErrorEventRequest) {
    if (data.source === "DANSER_PANIC") {
        await writeCrashReport(data.panic, "danser")
        ioClient.emit("job_error", { source: "DANSER_PANIC", panic: `danser crash: ${data.panic}` })
        return
    }
    ioClient.emit("job_error", data)
}

export function emitCustomizationChange(customization: ICustomizationSettings) {
    ioClient.emit("customization_change", customization)
}
