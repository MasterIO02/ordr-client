const { io } = require("socket.io-client")
const fs = require("fs")
const dataProcessor = require("./dataProcessor")
const config = require(process.cwd() + "/config.json")
const { isRendering, abortRender } = require("./danserHandler")
const { exit } = require("./util")
const version = 19
let ioClient

var socketUrl
if (config.customServer && config.customServer.clientUrl !== "") {
    socketUrl = config.customServer.clientUrl
} else {
    socketUrl = "https://ordr-clients.issou.best"
}

exports.startServer = async () => {
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
        ioClient.emit("id", config.id, version, config.usingOsuApi, config.motionBlurCapable, config.uhdCapable, isRendering(), customization)
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

<<<<<<< HEAD
    ioClient.on("version_too_old", async () => {
=======
    ioClient.on("cool_message", message => {
        console.log(`The o!rdr server says: ${message}`)
    })

    ioClient.on("version_too_old", () => {
>>>>>>> 5d580c244dfa5fe21cbdcc79c4724845280aa8fa
        console.log("This version of the client is too old! Restart it to apply the update.")
        config.needUpdate = true
        writeConfig()
        await exit()
    })

    ioClient.on("not_approved", async () => {
        console.log("This client still hasn't been approved to be used on o!rdr. You'll be pinged on the o!rdr Discord server when this client will be approved. It shouldn't take more than 2 days.")
        await exit()
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

    fs.watchFile(process.cwd() + "/config.json", { interval: 1000 }, () => {
        console.log("Detected change in the config file, telling changes to the server.")
        let newConfig = JSON.parse(fs.readFileSync(process.cwd() + "/config.json", { encoding: "utf-8" }))
        customization = newConfig.customization
        ioClient.emit("customization_change", newConfig.customization)
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
