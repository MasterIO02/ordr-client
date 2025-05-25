import { version } from "../package.json"
import config from "../config.json"
import updateClient from "./update"
import fetchStartupData from "./util/startup_data"
import prepareDanser from "./renderers/danser/prepare"
import { readKeyFile } from "./util/key"
import { startDiscordPresence } from "./util/discord_presence"
import connectToWebsocket from "./websocket"
import { state } from "./state"
import fs from "fs"

// removed custom songs folder support
// removed inactivity check support
// replaced custom server by dev mode

// TODO: better logging with multiline logs and progress bar
// TODO: implement auto update from github
// TODO: always delete rendered videos and replays after the render is done

async function main(): Promise<void> {
    let versionNumber = Number(version)
    if (isNaN(versionNumber)) {
        console.error("Invalid client version in the package.json file.")
        process.exit(1)
    }

    let startupData = await fetchStartupData()

    if (versionNumber < startupData.minimumClientVersion || versionNumber > startupData.maximumClientVersion) {
        console.log("This client version is outdated, updating now!")
        return await updateClient() // after updating we don't want to continue the startup so we return
    }

    if (!fs.existsSync("bins")) fs.mkdirSync("bins")

    await prepareDanser(startupData)

    let key = await readKeyFile()
    if (!key) {
        // TODO: do first launch
    } else {
        await connectToWebsocket(key.id, versionNumber)
        if (config.discord_presence) startDiscordPresence()
    }
}

main()

// we don't use the helper "exit" function because it exits cleanly, we don't want to let the user press a key to close the client since it's a fatal error
process.on("uncaughtException", async (err: Error) => {
    console.error("Encountered a fatal error (uncaught exception)", err)
    process.exit(1)
})

process.on("unhandledRejection", async (err: Error) => {
    if (err.toString() === "Error: Could not connect") {
        // "Error: Could not connect" is the error when the Discord rich presence cannot connect to Discord
        console.warn("Cannot connect to Discord to start the Rich Presence!")
        return
    }
    console.error("Encountered a fatal error (unhandled rejection)", err)
    process.exit(1)
})

// prevent ctrl+c stopping the client if it's currently working, on systems that aren't Windows
// see https://github.com/nodejs/node/issues/21825 for the reason
// tl;dr: detached processes on windows have a cmd popping up in the foreground, and danser needs to be detached for the client to not pass it the SIGINT messages
process.on("SIGINT", () => {
    if (!state.isWorking || process.platform === "win32") {
        process.exit()
    } else {
        console.log("A render is currently in progress. Please wait until it finishes.")
    }
})
