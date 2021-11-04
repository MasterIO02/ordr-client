const fs = require("fs")

if (!fs.existsSync(process.cwd() + "/config.json")) {
    fs.writeFileSync(process.cwd() + "/config.json", "{}", { encoding: "utf-8" })
}

let config = require(process.cwd() + "/config.json")
const { startServer } = require("./files/server")

if (Object.entries(config).length <= 4) {
    const defaultConfig = {
        debugLogs: false,
        customServer: {
            clientUrl: "",
            apiUrl: ""
        },
        deleteRenderedVideos: false,
        showFullDanserLogs: false,
        showFullFFmpegLogs: false,
        renderOnInactivityOnly: false,
        relay: "direct",
        needUpdate: false,
        usingOsuApi: false,
        osuApiKey: "",
        motionBlurCapable: false,
        uhdCapable: false
    }

    config = defaultConfig
    writeConfig()
}

if (typeof config.usingOsuApi === "undefined") {
    config.usingOsuApi = false
    config.osuApiKey = ""
    writeConfig()
}
if (typeof config.motionBlurCapable === "undefined") {
    config.motionBlurCapable = false
    writeConfig()
}
if (typeof config.debugLogs === "undefined") {
    config.debugLogs = false
    writeConfig()
}
if (typeof config.customServer === "undefined") {
    config.customServer = {
        clientUrl: "",
        apiUrl: ""
    }
}

if (typeof config.needUpdate === "undefined") {
    config.needUpdate = false
    writeConfig()
}
if (typeof config.deleteRenderedVideos === "undefined") {
    config.deleteRenderedVideos = false
    writeConfig()
}
if (typeof config.showFullDanserLogs === "undefined") {
    config.showFullDanserLogs = false
    writeConfig()
}
if (typeof config.showFullFFmpegLogs === "undefined") {
    config.showFullFFmpegLogs = false
    writeConfig()
}
if (typeof config.renderOnInactivityOnly === "undefined") {
    config.renderOnInactivityOnly = false
    writeConfig()
}

if (typeof config.relay === "undefined") {
    config.relay = "direct"
    writeConfig()
}

if (typeof config.uhdCapable === "undefined") {
    config.uhdCapable = false
    writeConfig()
}

if (config.needUpdate) {
    const clientUpdater = require("./files/clientUpdater")
    config.needUpdate = false
    writeConfig()
    clientUpdater()
} else if (config.id && config.customServer.apiUrl === "") {
    const checkDanserVersion = require("./files/checkDanserVersion")
    checkDanserVersion()
} else if (config.id) {
    startServer()
} else {
    // timeout to let time to the client to write the config
    setTimeout(() => {
        const firstLaunch = require("./files/firstLaunch")
        firstLaunch()
    }, 1000)
}

function writeConfig() {
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 1), "utf-8", err => {
        if (err) throw err
    })
}
