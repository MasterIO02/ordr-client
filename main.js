const fs = require("fs")
const { readConfig, writeConfig } = require("./files/util")
const axios = require("axios")
const version = 23
module.exports = { version }

async function main() {
    let config = await readConfig()
    const { startServer } = require("./files/server")

    if (config.logTimestamps) {
        require("log-timestamp")
    }

    const { data: data } = await axios.get("http://apis.issou.best/ordr/dansermd5")

    if (config.needUpdate || version != data.clientVersion) {
        const clientUpdater = require("./files/clientUpdater")
        if (process.pkg) {
            console.log("Detected different version compared to server. The pre-compiled version does not support auto-update. Get the latest client at https://github.com/MasterIO02/ordr-client/releases")
            await exit()
        } else {
            console.log("Client version seems incorrect or out of date. Running update.")
            clientUpdater()
        }
    } else if (config.id && config.customServer.apiUrl === "") {
        if (config.discordPresence && (config.customServer.apiUrl === "" || config.dev)) {
            const { startPresence } = require("./files/presence")
            startPresence()
        }
        const checkDanserVersion = require("./files/checkDanserVersion")
        checkDanserVersion()
    } else if (config.id) {
        // custom server
        if (config.discordPresence && (config.customServer.apiUrl === "" || config.dev)) {
            const { startPresence } = require("./files/presence")
            startPresence()
        }
        startServer()
    } else {
        const firstLaunch = require("./files/firstLaunch")
        firstLaunch()
    }
}

main()
