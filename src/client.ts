import { version } from "../package.json"
import updateClient from "./update"
import fetchStartupData from "./util/startup_data"
import { prepareDanserStartup } from "./renderers/danser/prepare"
import { readKeyFile } from "./util/key"
import { startDiscordPresence } from "./util/discord_presence"
import connectToWebsocket from "./websocket"
import { state } from "./state"
import fs from "fs"
import { config } from "./util/config"
import { prepareCommonAssets } from "./renderers/common"
import runFirstLaunch from "./first_launch"
import { parseArgs } from "util"
import { runBenchmark } from "./util/benchmark"

// TODO: better logging with multiline logs and progress bar
// TODO: implement auto update from github
// TODO: update readme

export async function startClient(): Promise<void> {
    const { values: args } = parseArgs({
        options: {
            benchmark: { type: "boolean", default: false }
        }
    })

    let versionNumber = Number(version)
    if (isNaN(versionNumber)) {
        console.error("Invalid client version in the package.json file.")
        process.exit(1)
    }

    const platform = process.platform
    if (platform !== "win32" && platform !== "linux") {
        console.log("The o!rdr client can only run under Windows or Linux operating systems.")
        process.exit(0)
    }

    let startupData = await fetchStartupData()
    if (versionNumber < startupData.minimumClientVersion || versionNumber > startupData.maximumClientVersion) {
        console.log("This client version is outdated, updating now!")
        return await updateClient() // after updating we don't want to continue the startup so we return
    }

    if (!fs.existsSync("bins")) fs.mkdirSync("bins")
    await prepareDanserStartup(startupData)
    await prepareCommonAssets()

    if (args.benchmark) {
        await runBenchmark()
        return
    }

    let key = await readKeyFile()
    if (!key) {
        await runFirstLaunch()
    } else {
        await connectToWebsocket(key.id, versionNumber)
        if (config.discord_presence) startDiscordPresence()
    }
}

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
    if (process.platform === "win32") process.exit()

    if (state.isWorking && !config.dev) {
        console.log("A render is currently in progress. Please wait until it finishes.")
    } else {
        process.exit()
    }
})
