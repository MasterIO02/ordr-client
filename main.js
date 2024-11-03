const { readConfig, updateConfig, exit } = require("./files/util")
const checkDanserVersion = require("./files/checkDanserVersion")
const axios = require("axios")
const fs = require("fs")
const version = 25
module.exports = { version }
const { startServer } = require("./files/server")
const firstLaunch = require("./files/firstLaunch")

async function main() {
    await updateConfig()

    let config = await readConfig()

    if (config.logTimestamps) {
        require("log-timestamp")
    }

    let clientData
    // we don't check for the client version on custom servers, but we do on dev mode
    if (config.customServer.apiUrl === "" || config.dev) {
        try {
            // we check for customServer.apiUrl here because we may be on dev mode
            clientData = await axios.get((config.customServer.apiUrl !== "" ? config.customServer.apiUrl : "https://apis.issou.best/ordr") + "/servers/version")
        } catch (e) {
            console.log("There was an issue while fetching initial client data. Check your internet connection, or is the o!rdr server down?")
            await exit()
        }
        clientData = clientData.data
    } else {
        // if we're using a custom server, we set the version that the server should have sent us to the current version to bypass the check
        clientData = { minimumClientVersion: version, maximumClientVersion: version }
    }

    if (version < clientData.minimumClientVersion || version > clientData.maximumClientVersion) {
        const clientUpdater = require("./files/clientUpdater")
        console.log("Client version seems incorrect or out of date. Running updater.")
        clientUpdater()
    } else if (config.id && (config.customServer.apiUrl === "" || config.dev)) {
        if (config.discordPresence) {
            const { startPresence } = require("./files/presence")
            startPresence()
        }
        if (!fs.existsSync("files/danser")) {
            await firstLaunch()
        } else {
            await checkDanserVersion(clientData.danserHashes, clientData.danserVersion)
            startServer()
        }
    } else if (config.id) {
        // custom server
        if (config.discordPresence && (config.customServer.apiUrl === "" || config.dev)) {
            const { startPresence } = require("./files/presence")
            startPresence()
        }
        if (!fs.existsSync("files/danser")) {
            await firstLaunch()
        } else {
            startServer()
        }
    } else {
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
