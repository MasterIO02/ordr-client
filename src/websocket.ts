import { io, Socket } from "socket.io-client"
import { state } from "./state"
import cleanExit from "./util/clean_exit"
import updateClient from "./update"
import writeCrashReport from "./util/crash_report"
import { config } from "./util/config"

let ioClient: Socket
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

    // TODO: rework incoming data and rename to "jobs"
    ioClient.on("data", data => {
        // TODO: run render
    })

    ioClient.on("cool_message", async (message, exit) => {
        console.log(`The o!rdr server says: ${message}`)
        if (exit) {
            ioClient.disconnect()
            await cleanExit()
        }
    })

    ioClient.on("version_too_old", async () => {
        console.log("This version of the client is too old!")
        ioClient.disconnect()
        await updateClient()
    })

    ioClient.on("abort_render", () => {
        console.log("Received an abort from the o!rdr server, cancelling current job.")
        // TODO: reimplement abortRender()
        // abortRender()
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
