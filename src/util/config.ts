import fs from "fs"
import { z } from "zod"
import { emitCustomizationChange } from "../websocket"
import chokidar from "chokidar"

const EMPTY_CONFIG = {
    "encoder": "cpu",
    "relay": "direct",
    "discord_presence": false,
    "debug": false,
    "log_timestamps": false,
    "capabilities": {
        "danser": {
            "motion_blur": false,
            "uhd": false
        }
    },
    "accept_jobs": {
        "danser_videos": true
    },
    "customization": {
        "text_color": "",
        "background_type": 0
    }
}

const ConfigSchema = z.object({
    encoder: z.enum(["cpu", "nvenc", "qsv"]),
    relay: z.enum(["direct", "us"]),
    discord_presence: z.boolean(),
    debug: z.boolean(),
    log_timestamps: z.boolean().optional(),
    capabilities: z.object({
        danser: z.object({
            motion_blur: z.boolean(),
            uhd: z.boolean()
        })
    }),
    accept_jobs: z.object({
        danser_videos: z.boolean()
    }),
    dev: z
        .object({
            server: z.object({
                api: z.string(),
                account_api: z.string(),
                websocket: z.string(),
                shortlink: z.string()
            })
        })
        .optional(),
    customization: z.object({
        text_color: z.string(),
        background_type: z.number().int()
    })
})

export type TConfig = z.infer<typeof ConfigSchema>

/**
 * @description the current client config.json state
 */
export let config: TConfig

/**
 * @description write a new config.json file
 */
export async function generateConfig(): Promise<void> {
    fs.writeFileSync("config.json", JSON.stringify(EMPTY_CONFIG, null, 2), { encoding: "utf-8" })
}

/**
 * @description read the client config.json and sets the local config to it
 * @returns the parsed config if it's valid, null if it's not
 */
export async function readConfig(): Promise<TConfig | null> {
    let rawConfig = fs.readFileSync("config.json", { encoding: "utf-8" })
    try {
        let parsedConfig = ConfigSchema.parse(JSON.parse(rawConfig))
        config = parsedConfig
        return parsedConfig
    } catch (err) {
        console.error("Invalid config!", err)
        return null
    }
}

/**
 * @description Overwrite the current config.json file by a new one
 * @param config The new config to write, will be checked for validity before overwriting
 */
export async function writeConfig(config: object): Promise<void> {
    try {
        ConfigSchema.parse(config)
    } catch (err) {
        console.error("Tried to overwrite config.json file by an invalid config", err)
        return
    }

    // at this point the config we want to push is valid
    fs.writeFileSync("config.json", JSON.stringify(config, null, 2), { encoding: "utf-8" })
}

/**
 * @description Watch the config.json for change and do things if needed
 */
export async function watchConfig() {
    let lastConfig = await readConfig()
    if (!lastConfig) {
        console.error("Config is null, can't watch for config.json changes.")
        return
    }

    chokidar.watch("config.json").on("change", async () => {
        if (!lastConfig) return

        let newConfig = await readConfig()
        if (!newConfig) {
            // do nothing if the config is invalid, as we have a valid config cached
            console.error("Your modified config is invalid!")
            return
        }

        if (lastConfig.customization.text_color === newConfig.customization.text_color && lastConfig.customization.background_type === newConfig.customization.background_type) return
        console.log("Detected change in the config file, telling changes to the server.")
        emitCustomizationChange({ textColor: newConfig.customization.text_color, backgroundType: newConfig.customization.background_type })
        lastConfig = newConfig
    })
}
