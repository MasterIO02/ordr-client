const fs = require("fs")

if (!fs.existsSync(process.cwd() + "/config.json")) {
    fs.writeFileSync(process.cwd() + "/config.json", "{}", { encoding: "utf-8" })
}

let config = require(process.cwd() + "/config.json")
const { startServer } = require("./files/server")

if (Object.entries(config).length === 0) {
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
        motionBlurCapable: false
    }

    config = defaultConfig
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
