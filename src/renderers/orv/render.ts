import { spawn, ChildProcess } from "child_process"
import fs from "fs"
import path from "path"
import { config } from "../../util/config"
import { TORVError } from "../../websocket_types"

export type TORVResult = { success: true } | { success: false; error: TORVError; exit?: boolean; panic?: string }

let currentORVProcess: ChildProcess | null = null
let abortReason: string | null = null

const ORV_EXEC = path.resolve(process.platform === "win32" ? "bins/orv/osu-replay-viewer.exe" : "bins/orv/osu-replay-viewer")
const ORV_DATA_PATH = `${process.cwd()}/data/orv-data`
const ORV_CONFIG_PATH = `${process.cwd()}/data/orv-data/orv-config.json`
const REALM_PATH = `${ORV_DATA_PATH}/osu_replay_viewer/client.realm`

/**
 * @description Check if a beatmap exists in ORV's Realm database by its .osu file MD5
 */
export async function verifyRealmBeatmap(md5: string): Promise<boolean> {
    return new Promise(resolve => {
        if (!fs.existsSync(REALM_PATH)) {
            if (config.debug) console.debug("Realm database not found, beatmap verification failed")
            resolve(false)
            return
        }

        let proc = spawn(ORV_EXEC, ["--realm-has-beatmap", REALM_PATH, md5], { timeout: 15_000 })
        let stdout = ""

        proc.stdout?.on("data", (data: Buffer) => {
            stdout += data.toString()
        })
        proc.on("close", () => {
            let result = stdout.includes("REALM_BEATMAP_FOUND::true")
            if (config.debug) console.debug(`Realm beatmap check for ${md5}: ${result}`)
            resolve(result)
        })
        proc.on("error", () => resolve(false))
    })
}

/**
 * @description Check if a skin exists in ORV's Realm database. Returns the skin's GUID if found, null otherwise
 */
export async function verifyRealmSkin(skinArchiveName: string): Promise<string | null> {
    return new Promise(resolve => {
        if (!fs.existsSync(REALM_PATH)) {
            if (config.debug) console.debug("Realm database not found, skin verification failed")
            resolve(null)
            return
        }

        let proc = spawn(ORV_EXEC, ["--realm-find-skin", REALM_PATH, skinArchiveName], { timeout: 15_000 })
        let stdout = ""

        proc.stdout?.on("data", (data: Buffer) => {
            stdout += data.toString()
        })
        proc.on("close", () => {
            let match = stdout.match(/REALM_SKIN_ID::([a-f0-9-]+)/)
            let guid = match ? match[1] : null
            if (config.debug) console.debug(`Realm skin check for ${skinArchiveName}: ${guid}`)
            resolve(guid)
        })
        proc.on("error", () => resolve(null))
    })
}

/**
 * @description Import a skin into ORV's data directory (via lazer), then verify it landed in Realm
 * @param skinPath relative path of the .osk file to import
 */
export async function importSkin(skinPath: string): Promise<TORVResult> {
    console.log(`Importing skin ${skinPath} into ORV...`)
    const absoluteSkinPath = path.resolve(skinPath)
    const result = await runORV(["--yes", "--skin", "import", absoluteSkinPath, "--data-path", ORV_DATA_PATH])

    if (!result.success) return result

    // verify the skin was imported by checking the Realm
    let skinArchiveName = skinPath.split("/").pop()?.replace(".osk", "") ?? ""
    let skinGuid = await verifyRealmSkin(skinArchiveName)

    if (!skinGuid) {
        console.error("Skin import verification failed: skin not found in Realm after import")
        return { success: false, error: "REALM_CHECK_FAILED" }
    }

    console.log(`Skin imported successfully (Realm GUID: ${skinGuid})`)
    return { success: true }
}

/**
 * @description Take a screenshot of a beatmap at a given timestamp using ORV's --view md5 mode
 * @param mapMd5 MD5 hash of the .osu beatmap file in Realm
 * @param timestampMs timestamp in milliseconds to capture
 * @param outputPath absolute path where the PNG screenshot will be written
 * @param skinGuid Realm GUID of the skin to apply (from verifyRealmSkin)
 */
export async function takeScreenshot(mapMd5: string, timestamp: { time: number; title: string }, outputPath: string, skinGuid: string): Promise<TORVResult> {
    console.log(`Taking screenshot at ${timestamp.time}ms (${timestamp.title}) for beatmap ${mapMd5} with skin ${skinGuid}`)

    return runORV(["--yes", "--skin", "id", skinGuid, "--view", "md5", mapMd5, "--screenshot", String(timestamp.time), "--screenshot-output", outputPath, "--data-path", ORV_DATA_PATH, "--config", ORV_CONFIG_PATH])
}

/**
 * @description Spawn an ORV process with the given arguments, track it for abort support and handle errors/panics
 */
async function runORV(args: string[]): Promise<TORVResult> {
    const EXCEPTION_REGEX = /^[\w.]+Exception[:\s]/

    return new Promise(resolve => {
        let panicLogs: string[] = []
        let resolved = false

        let proc = spawn(ORV_EXEC, args, {
            cwd: "bins/orv",
            stdio: ["ignore", "pipe", "pipe"],
            detached: process.platform === "linux"
        })

        currentORVProcess = proc

        proc.stdout?.on("data", (data: Buffer) => {
            let line = data.toString()
            if (config.debug) console.debug(`[ORV stdout] ${line.trim()}`)

            if (line.includes("Beatmap not found")) {
                if (!resolved) {
                    resolved = true
                    resolve({ success: false, error: "BEATMAP_NOT_FOUND" })
                }
            }

            // detect .NET unhandled exception dumps (like "System.NullReferenceException: ...")
            // this matches the standard .NET exception header format, hopefully this will not break when a mapper decides to name its map or diff to match this regex
            if (EXCEPTION_REGEX.test(line)) {
                panicLogs.push(line.trim())
            }
        })

        proc.stderr?.on("data", (data: Buffer) => {
            let line = data.toString()
            if (config.debug) console.debug(`[ORV stderr] ${line.trim()}`)

            if (line.includes("Beatmap not found")) {
                if (!resolved) {
                    resolved = true
                    resolve({ success: false, error: "BEATMAP_NOT_FOUND" })
                }
            }

            if (EXCEPTION_REGEX.test(line)) {
                panicLogs.push(line.trim())
            }
        })

        proc.on("error", err => {
            if (!resolved) {
                resolved = true
                console.error("Failed to start ORV process:", err)
                resolve({ success: false, error: "KILLED_UNKNOWN" })
            }
        })

        proc.on("close", code => {
            currentORVProcess = null

            if (resolved) return

            if (abortReason === "STUCK") {
                resolved = true
                abortReason = null
                console.error("ORV process was killed due to timeout (global screenshot timeout)")
                resolve({ success: false, error: "KILLED_STUCK" })
                return
            }

            if (abortReason === "REQUESTED") {
                resolved = true
                abortReason = null
                resolve({ success: false, error: "KILLED_REQUESTED" })
                return
            }

            resolved = true

            if (panicLogs.length > 0) {
                console.error("ORV process panicked:", panicLogs.join("\n"))
                resolve({ success: false, error: "PANIC", panic: panicLogs.join("\n") })
                return
            }

            if (code !== 0) {
                console.error(`ORV process exited with code ${code}`)
                resolve({ success: false, error: "SCREENSHOT_FAILED" })
                return
            }

            resolve({ success: true })
        })
    })
}

/**
 * @description Kill the currently running ORV process. Called by the global screenshot timeout or by the server's abort_render event
 */
export function abortORVRender(reason: string = "REQUESTED") {
    abortReason = reason
    if (currentORVProcess) {
        console.log(`Aborting ORV render (reason: ${reason})`)
        currentORVProcess.kill("SIGKILL")
    }
}
