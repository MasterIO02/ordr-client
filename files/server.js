const io = require("socket.io-client")
const fs = require("fs")
const dataProcessor = require("./dataProcessor")
const config = require(process.cwd() + "/config.json")
const { isRendering } = require("./danserHandler")
const version = 11
let ioClient

var socketUrl
if (config.customServer && config.customServer.clientUrl !== "") {
    socketUrl = config.customServer.clientUrl
} else {
    socketUrl = "https://ordr-clients.issou.best"
}

exports.startServer = async () => {
    ioClient = io.connect(socketUrl)

    console.log("Server started!")

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
                ioClient.disconnect()
            } else if (desktopIdle.getIdleTime() > 45 && !ioClient.connected) {
                console.log("The computer is idle, reconnecting to the o!rdr server.")
                ioClient.connect()
            }
        }, 60000)
    }

    ioClient.on("connect", () => {
        console.log("Connected to the o!rdr server!")
        ioClient.emit("id", config.id, version, config.usingOsuApi, config.motionBlurCapable, config.uhdCapable)
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

    ioClient.on("version_too_old", () => {
        console.log("This version of the client is too old! Restart it to apply the update.")
        config.needUpdate = true
        writeConfig()
        process.exit()
    })

    ioClient.on("connect_error", err => {
        if (config.debugLogs) {
            console.log(`Connection error: ${err.message}`)
        }
    })
}

exports.sendProgression = data => {
    ioClient.emit("progression", {
        id: config.id,
        progress: data
    })
}

exports.reportPanic = data => {
    ioClient.emit("panic", {
        id: config.id,
        crash: data
    })
}

function writeConfig() {
    const fs = require("fs")
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 1), "utf-8", err => {
        if (err) throw err
    })
}
