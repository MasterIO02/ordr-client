const { readConfig, exit } = require("./files/util")
const axios = require("axios")
const version = 23
module.exports = { version }

async function main() {
    let config = await readConfig()
    const { startServer } = require("./files/server")

    if (config.logTimestamps) {
        require("log-timestamp")
    }

    let clientData
    try {
        clientData = await axios.get("https://apis.issou.best/ordr/servers/version")
    } catch (e) {
        console.log("There was an issue while fetching initial client data. Check your internet connection, or is the o!rdr server down?")
        await exit()
    }
    clientData = clientData.data

    if (version != clientData.clientVersion) {
        const clientUpdater = require("./files/clientUpdater")
        console.log("Client version seems incorrect or out of date. Running updater.")
        clientUpdater()
    } else if (config.id && config.customServer.apiUrl === "") {
        if (config.discordPresence && (config.customServer.apiUrl === "" || config.dev)) {
            const { startPresence } = require("./files/presence")
            startPresence()
        }
        const checkDanserVersion = require("./files/checkDanserVersion")
        checkDanserVersion(clientData.danserHashes, clientData.danserVersion)
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

// we don't use the helper "exit" function because it exits cleanly, we don't want to let the user press a key to close the client since it's a fatal error
process.on("uncaughtException", async e => {
    console.log("Fatal error (uncaught exception)", e)
    process.exit(1)
})

process.on("unhandledRejection", async e => {
    if (e.toString() === "Error: Could not connect") {
        // "Error: Could not connect" is the error when the Discord rich presence cannot connect to Discord
        console.log("Cannot connect to Discord to start the Rich Presence!")
        return
    }
    console.log("Fatal error (unhandled rejection)", e)
    process.exit(1)
})
