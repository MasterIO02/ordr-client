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
import { abortORVRender } from "./renderers/orv/render"
import { getEphemeralClientId, setEphemeralClientId, TKeysFile } from "./util/keys"
import { isEphemeral, parseEphemeralEnv } from "./util/ephemeral"
import { triggerDanserRenderJob } from "./renderers/danser/job"
import { triggerSkinPreviewJob } from "./renderers/orv/job"

let ioClient: Socket<WssServerToClientEvents, WssClientToServerEvents>
let clientId: string
let didConnect: boolean = false // set to true on the first connection to the server

export default async function connectToWebsocket(keys: TKeysFile | null, version: number, benchmarkFps?: number) {
    if (keys) clientId = keys.client_id
    let socketUrl = config.dev ? config.dev.server.websocket : "https://ordr-clients.issou.best"
    const socket = io(socketUrl, { reconnectionDelay: 10000, reconnectionDelayMax: 10000 })
    ioClient = socket.connect()

    let customization = config.customization
    // in ephemeral mode the osu! API credentials come from the environment, there's no keys file
    let osuCredentials = isEphemeral ? parseEphemeralEnv().osuApi : keys?.osu

    setTimeout(() => {
        if (!ioClient.connected && !didConnect) {
            console.log("Cannot connect to the o!rdr server. Trying to connect...")
        }
    }, 2000)

    ioClient.on("connect", () => {
        let connectedLog = "Connected to the o!rdr server!"
        if (!didConnect) connectedLog += " Waiting for a job."

        console.log(connectedLog)

        // if the server already assigned us an ephemeral ID, re-auth with it instead of the master key.
        // the server keeps the ephemeral client around for a bit after a disconnect, so it can recognize us on reconnect (e.g. after an internet hiccup) instead of creating a whole new ephemeral client
        let ephemeralId = isEphemeral ? getEphemeralClientId() : undefined

        ioClient.emit("auth", {
            id: isEphemeral ? ephemeralId : clientId,
            version: version,
            usingOsuApi: Boolean(osuCredentials?.oauth_client_id && osuCredentials?.oauth_client_secret),
            encodingWith: config.encoder,
            isRendering: state.isWorking,
            capabilities: {
                danser: config.capabilities.danser
            },
            acceptJobs: {
                danser_videos: config.accept_jobs.danser_videos,
                // only accept skin preview jobs if ORV was actually prepared at startup, not just enabled in the config afterwards (the config can change at runtime but ORV is only prepared at startup)
                orv_skin_previews: config.accept_jobs.orv_skin_previews && state.orvPrepared
            },
            customization: {
                textColor: customization.text_color,
                backgroundType: customization.background_type
            },

            // ephemeral clients only, on the first auth (no assigned ID yet)
            masterKey: isEphemeral && !ephemeralId ? parseEphemeralEnv().masterKey : undefined,
            benchmark: isEphemeral && !ephemeralId && benchmarkFps !== undefined ? { danser: benchmarkFps } : undefined
        })

        if (!didConnect) {
            // watch for config changes once we're connected to the o!rdr server to avoid trying to send updated to the server when we're not connected to it
            watchConfig()
        }

        didConnect = true
    })

    ioClient.on("ephemeral_auth_result", data => {
        if (!isEphemeral) return // event should only be processed when we know we're in ephemeral mode. server shouldn't send this if we're not anyway
        setEphemeralClientId(data.id)
        console.log(`Received our ephemeral client ID.`)
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
        } else if (data.job === "SKIN_PREVIEW") {
            const jobState = await triggerSkinPreviewJob(data.jobData)
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

    ioClient.on("job_idle", () => {
        // set isWorking to false when the server tells us we're Idle, to make sure that if the user spams CTRL+C the render won't be reset
        state.isWorking = false
    })

    ioClient.on("invalid_version", data => {
        console.log("This version of the client is too old!")
        ioClient.disconnect()
        updateClient(data.expectedVersion)
    })

    ioClient.on("abort_render", async () => {
        console.log("Received an abort from the o!rdr server, cancelling current job.")
        abortDanserRender("REQUESTED")
        abortORVRender("REQUESTED")
    })

    ioClient.on("connect_error", err => {
        console.log(`Websocket connection error: ${err.message}`)
    })
}

/**
 * @description Run what we have to run when a job ends locally, whether it succeeded or failed
 * @param success Did the job succeed? Defaults to false because this function should be called in a SINGLE line with success = true
 */
async function endJob(success: boolean = false) {
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
    } else if (data.source === "ORV_PANIC") {
        await writeCrashReport(data.panic, "orv")
        ioClient.emit("job_error", { source: "ORV_PANIC", panic: `osu-replay-viewer crash: ${data.panic}` })
        return
    }
    ioClient.emit("job_error", data)
}

export function emitCustomizationChange(customization: ICustomizationSettings) {
    ioClient.emit("customization_change", customization)
}
