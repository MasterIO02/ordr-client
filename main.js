const config = require('./config.json')
const firstLaunch = require('./files/firstLaunch')
const checkDanserVersion = require('./files/checkDanserVersion')
const fs = require('fs')

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


if (config.id) {
    checkDanserVersion()
} else {
    firstLaunch()
}

function writeConfig() {
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 1), 'utf-8', (err) => {
        if (err) throw err
    })
}