import fs from "fs"
import { generateConfig, readConfig } from "./util/config"

async function main() {
    // generate a new config if there's none
    if (!fs.existsSync("config.json")) await generateConfig()

    // parse and read the config first
    if (!(await readConfig())) {
        // we have an invalid config.json file, exiting the client (invalid values are logged by readConfig)
        process.exit(1)
    }

    // dynamically importing the main client function when we're sure we have the config in memory
    let client = await import("./client")
    client.startClient()
}

main()
