import fs from "fs"
import { z } from "zod"
import { emitCustomizationChange } from "../websocket"
import chokidar from "chokidar"

const EMPTY_CONFIG = {
    "encoder": "cpu",
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
        "danser_videos": true,
        "orv_skin_previews": true
    },
    "customization": {
        "text_color": "",
        "background_type": 0
    }
}

const ConfigSchema = z.object({
    encoder: z.enum(["cpu", "nvenc", "qsv"]),
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
        danser_videos: z.boolean(),
        orv_skin_previews: z.boolean()
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
 * @description Recursively merge defaults into a raw config object, filling in any missing fields.
 * Existing values are preserved, only missing keys get the default value.
 */
function deepMergeDefaults(raw: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
    let result: Record<string, unknown> = { ...raw }
    for (const key of Object.keys(defaults)) {
        if (result[key] === undefined) {
            result[key] = defaults[key]
        } else if (typeof defaults[key] === "object" && defaults[key] !== null && !Array.isArray(defaults[key]) && typeof result[key] === "object" && result[key] !== null && !Array.isArray(result[key])) {
            result[key] = deepMergeDefaults(result[key] as Record<string, unknown>, defaults[key] as Record<string, unknown>)
        }
    }
    return result
}

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
        let parsed = JSON.parse(rawConfig)
        let merged = deepMergeDefaults(parsed, EMPTY_CONFIG)

        // write back to disk if any fields were missing, so the config file stays complete
        if (JSON.stringify(parsed) !== JSON.stringify(merged)) {
            fs.writeFileSync("config.json", JSON.stringify(merged, null, 2), { encoding: "utf-8" })
            console.log("Config has missing fields, added new defaults.")
        }

        let parsedConfig = ConfigSchema.parse(merged)
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
