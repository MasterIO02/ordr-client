const { io } = require("socket.io-client")
const fs = require("fs")
const dataProcessor = require("./dataProcessor")
const { isRendering, abortRender } = require("./danserHandler")
const { exit, readConfig } = require("./util")
const { version } = require("./../main")

let ioClient

let config

exports.startServer = async () => {
    config = await readConfig()

    let socketUrl
    if (config.customServer && config.customServer.clientUrl !== "") {
        socketUrl = config.customServer.clientUrl
    } else {
        socketUrl = "https://ordr-clients.issou.best"
    }

    const socket = io(socketUrl, { reconnectionDelay: 10000, reconnectionDelayMax: 10000 })
    ioClient = socket.connect()

    console.log("Server started!")

    let customization = config.customization

    setTimeout(() => {
        if (!ioClient.connected) {
            console.log("Cannot connect to the o!rdr server. Trying to connect...")
        }
    }, 2000)

    if (config.renderOnInactivityOnly) {
        const desktopIdle = require("desktop-idle")
        setInterval(() => {
            if (isRendering() === false && desktopIdle.getIdleTime() < 30 && ioClient.connected) {
                console.log("The computer is being used, disconnecting from the o!rdr server.")
                // when using .disconnect() socket.io won't try to reconnect automatically
                ioClient.disconnect()
            } else if (desktopIdle.getIdleTime() > 45 && !ioClient.connected) {
                console.log("The computer is idle, reconnecting to the o!rdr server.")
                ioClient.connect()
            }
        }, 60000)
    }

    ioClient.on("connect", () => {
        console.log("Connected to the o!rdr server!")
        ioClient.emit("id", { id: config.id, version: version, usingOsuApi: config.usingOsuApi, motionBlurCapable: config.motionBlurCapable, uhdCapable: config.uhdCapable, isRendering: isRendering(), encodingWith: config.encoder, customization: customization })
    })

    ioClient.on("disconnect", () => {
        console.log("Disconnected from the server!")
    })

    ioClient.on("data", data => {
        if (!fs.existsSync("./files/danser/settings/default.json")) {
            console.log(
                `danser's settings file is missing! It's probably because you made a "clean" installation of the client without having recreated the Songs/Skins folders or having danser regenerate its settings file. You should run the benchmark (achievable without having the client's config.json file containing your ID), don't let the client send an application request, just CTRL+C when the benchmark finished. Then, replace the new config.json by the new one with your ID in it.`
            )
        }
        dataProcessor(data)
    })

    ioClient.on("cool_message", async (message, willExit) => {
        console.log(`The o!rdr server says: ${message}`)
        if (willExit) {
            ioClient.disconnect()
            await exit()
        }
    })

    ioClient.on("version_too_old", async () => {
        console.log("This version of the client is too old!")
        const clientUpdater = require("./clientUpdater")
        clientUpdater()
    })

    ioClient.on("abort_render", () => {
        console.log("Got abort from the o!rdr server.")
        abortRender()
    })

    ioClient.on("connect_error", err => {
        if (config.debugLogs) {
            console.log(`Connection error: ${err.message}`)
        }
    })

    let lastConfig = await readConfig()
    fs.watchFile(process.cwd() + "/config.json", { interval: 1000 }, async () => {
        let newConfig = await readConfig()
        if (lastConfig.customization.textColor === newConfig.customization.textColor && lastConfig.customization.backgroundType === newConfig.customization.backgroundType) return
        console.log("Detected change in the config file, telling changes to the server.")
        customization = config.customization
        ioClient.emit("customization_change", newConfig.customization)
        lastConfig = newConfig
    })
}

exports.sendProgression = data => {
    ioClient.emit("progression", {
        id: config.id,
        progress: data
    })
}

exports.handlePanic = data => {
    ioClient.emit("panic", {
        id: config.id,
        crash: data
    })
    if (!fs.existsSync("crashes")) {
        fs.mkdirSync("crashes")
    }
    let date = new Date()
    let today = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getHours().toString().padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}-${date.getSeconds().toString().padStart(2, "0")}`

    fs.appendFileSync(`crashes/${today}-crash-report.txt`, `${data}\n`, "utf-8")
}
