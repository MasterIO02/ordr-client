export interface IEphemeralEnv {
    masterKey: string
    renderers: { danser: boolean; orv: boolean }
    encoder: "cpu" | "nvenc" | "qsv"
    debug: boolean
    logTimestamps: boolean
    osuApi: { oauth_client_id: string; oauth_client_secret: string }
    capabilities: { danser: { motion_blur: boolean; uhd: boolean } }
}

/**
 * @description whether ORDR_MASTER_KEY is set. if it is, we are running in ephemeral mode
 */
export const isEphemeral = Boolean((process.env.ORDR_MASTER_KEY ?? "").trim())

/**
 * @description parse a boolean environment variable. Unset = false, unrecognized = exit
 */
function parseBool(name: string, value: string | undefined): boolean {
    if (value === undefined || !value.trim()) return false
    let trimmed = value.trim().toLowerCase()
    if (["true", "1", "yes", "on"].includes(trimmed)) return true
    if (["false", "0", "no", "off"].includes(trimmed)) return false
    console.error(`Invalid boolean value for ${name}: "${value}", must be true/false, 1/0, yes/no or on/off.`)
    process.exit(1)
}

let cachedEnv: IEphemeralEnv | undefined

/**
 * @description parse and validate all ORDR_* environment variables and cache the result, for ephemeral mode only
 */
export function parseEphemeralEnv(): IEphemeralEnv {
    if (!isEphemeral) {
        console.error("Tried to parse ephemeral environment variables without ORDR_MASTER_KEY set.")
        process.exit(1)
    }
    if (cachedEnv) return cachedEnv

    let masterKey = (process.env.ORDR_MASTER_KEY ?? "").trim()

    let renderers = { danser: false, orv: false }
    let rawRenderers = process.env.ORDR_RENDERERS
    if (!rawRenderers || !rawRenderers.trim()) {
        renderers = { danser: true, orv: true }
    } else {
        for (const entry of rawRenderers.split(",")) {
            let name = entry.trim().toLowerCase()
            if (!name) continue
            if (name === "danser") {
                renderers.danser = true
            } else if (name === "orv") {
                renderers.orv = true
            } else {
                console.error(`Unknown renderer name in ORDR_RENDERERS: "${name}", must be "danser" or "orv".`)
                process.exit(1)
            }
        }
        if (!renderers.danser && !renderers.orv) {
            console.error("No renderers are enabled (ORDR_RENDERERS), the client can't render anything!")
            process.exit(1)
        }
    }

    let rawEncoder = (process.env.ORDR_ENCODER ?? "").trim().toLowerCase()
    let encoder: IEphemeralEnv["encoder"]
    if (!rawEncoder) {
        encoder = "cpu"
    } else if (rawEncoder === "cpu" || rawEncoder === "nvenc" || rawEncoder === "qsv") {
        encoder = rawEncoder
    } else {
        console.error(`Invalid ORDR_ENCODER value: "${process.env.ORDR_ENCODER}", must be "cpu", "nvenc" or "qsv".`)
        process.exit(1)
    }

    cachedEnv = {
        masterKey,
        renderers,
        encoder,
        debug: parseBool("ORDR_DEBUG", process.env.ORDR_DEBUG),
        logTimestamps: parseBool("ORDR_LOG_TIMESTAMPS", process.env.ORDR_LOG_TIMESTAMPS),
        osuApi: {
            oauth_client_id: process.env.ORDR_OSU_CLIENT_ID ?? "",
            oauth_client_secret: process.env.ORDR_OSU_CLIENT_SECRET ?? ""
        },
        capabilities: {
            danser: {
                motion_blur: parseBool("ORDR_DANSER_MOTION_BLUR", process.env.ORDR_DANSER_MOTION_BLUR),
                uhd: parseBool("ORDR_DANSER_UHD", process.env.ORDR_DANSER_UHD)
            }
        }
    }
    return cachedEnv
}
