const fs = require("fs")
const { readConfig, writeConfig, exit } = require("./files/util")

async function main() {
    let config = await readConfig()
    const { startServer } = require("./files/server")

    if (config.logTimestamps) {
        require("log-timestamp")
    }

    if (config.needUpdate) {
        const clientUpdater = require("./files/clientUpdater")
        await writeConfig("needUpdate", true)
        clientUpdater()
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
