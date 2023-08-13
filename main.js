const fs = require("fs")
const { startPresence } = require("./files/presence")

if (!fs.existsSync(process.cwd() + "/config.json")) {
    fs.writeFileSync(process.cwd() + "/config.json", "{}", { encoding: "utf-8" })
}

let config = require(process.cwd() + "/config.json")
const { startServer } = require("./files/server")

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
    config.deleteRenderedVideos = true
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

if (typeof config.customSongsFolderPath === "undefined") {
    config.customSongsFolderPath = ""
    writeConfig()
}

if (typeof config.logTimestamps === "undefined") {
    config.logTimestamps = false
    writeConfig()
}

if (typeof config.discordPresence === "undefined") {
    config.discordPresence = false
    writeConfig()
}

if (typeof config.customization === "undefined") {
    config.customization = {
        textColor: "",
        backgroundType: 0
    }
    writeConfig()
}

if (config.logTimestamps) {
    require("log-timestamp")
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
    if (config.discordPresence && (config.customServer.apiUrl === "" || config.dev)) startPresence()
    startServer()
} else {
    const firstLaunch = require("./files/firstLaunch")
    firstLaunch()
}

function writeConfig() {
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 1), "utf-8", err => {
        if (err) throw err
    })
}
