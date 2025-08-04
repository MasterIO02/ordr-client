import fs from "fs"
import { generateConfig, readConfig } from "./util/config"
import injectTimestamp from "./util/inject_timestamp"

async function main() {
    // generate a new config if there's none
    if (!fs.existsSync("config.json")) await generateConfig()

    // parse and read the config first
    let config = await readConfig()
    if (!config) {
        // we have an invalid config.json file, exiting the client (invalid values are logged by readConfig)
        process.exit(1)
    }

    if (config.log_timestamps) injectTimestamp()

    // dynamically importing the main client function when we're sure we have the config in memory
    let client = await import("./client")
    client.startClient()
}

main()
