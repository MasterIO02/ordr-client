import { IJobData } from "../../websocket_types"
import fs from "fs"
import { handlePanic, sendProgression } from "../../websocket"
import { ChildProcessByStdio, spawn } from "child_process"
import Stream from "stream"
import { config } from "../../util/config"

type TDanserError = "BEATMAP_NOT_FOUND" | "BAD_OSU_OAUTH" | "PANIC" | "INVALID_DATA" | "NON_RENDER_ERROR" | "KILLED_STUCK" | "KILLED_UNKNOWN" | "KILLED_REQUESTED"
type TRenderResult = { success: true } | { success: false; error: TDanserError; exit?: boolean }
type TDanserAbortReason = "STUCK" | "REQUESTED"

let danserProcess: ChildProcessByStdio<null, Stream.Readable, Stream.Readable>
let abortReason: TDanserAbortReason | null = null

export default async function renderDanserVideo(jobData: IJobData): Promise<TRenderResult> {
    let videoFilename = `render${jobData.renderID}`

    let danserArguments = ["-replay", `${process.cwd()}/data/replays/${jobData.renderID}.osr`, "-out", videoFilename, "-noupdatecheck"]
    if (jobData.skip) {
        danserArguments.push("-skip")
    }
    if (jobData.addPitch) {
        danserArguments.push("-pitch=1.5")
    }

    let canGetProgress = false
    let isPanicking = false
    let panicLogs = ""

    // stuckCheckInterval is the interval that will check if the video file danser is currently generating is growing or not
    let tempFilesPath = `bins/danser/videos/${videoFilename}_temp/`
    let lastVideoSize = 0
    let lastAudioSize = 0
    let stuckCheckInterval = setInterval(() => {
        if (!fs.existsSync(tempFilesPath + "video.mp4")) return

        let videoSize = fs.existsSync(tempFilesPath + "video.mp4") ? fs.statSync(tempFilesPath + "video.mp4").size : lastVideoSize + 1
        let audioSize = fs.existsSync(tempFilesPath + "audio.mp4") ? fs.statSync(tempFilesPath + "audio.mp4").size : lastAudioSize + 1

        if (videoSize <= lastVideoSize && audioSize <= lastAudioSize) {
            console.log("Seems like danser is stuck! Killing the process, waiting for a new task.")
            abortDanserRender("STUCK")
        } else {
            lastVideoSize = videoSize
            lastAudioSize = audioSize
        }
    }, 30000)

    let renderResult = await new Promise<TRenderResult>(resolve => {
        // stdio: [stdin, stdout, stderr], ignoring stdin to not passthrough CTRL+C and let the parent (the o!rdr client) handle it (in server.js)
        // danser needs to be detached from the client for this to work, so this has no effect on Windows (see SIGINT catcher in server.js)
        let danserExecutable = process.platform === "win32" ? "./danser-cli.exe" : "./danser-cli"
        danserProcess = spawn(danserExecutable, danserArguments, { cwd: "bins/danser", stdio: ["ignore", "pipe", "pipe"], detached: process.platform === "win32" ? false : true })
        danserProcess.stdout.setEncoding("utf8")
        danserProcess.stdout.on("data", data => {
            if (config.debug) console.debug(data)

            // we can start processing the "Progress" logs from danser once we see the "Starting encoding", else we may catch the Progess logs from pp processing
            if (data.includes("Starting encoding")) canGetProgress = true

            if (data.includes("Progress") && canGetProgress) {
                // TODO next ver: send progression percentage data as a number
                sendProgression(data)
                if (!config.debug) console.log(data)
            }

            // render is finished, we have nothing more to do with danser, can resolve this promise
            if (data.includes("Finished.")) {
                console.log(`Rendering done.`)
                resolve({ success: true })
            }

            if (data.includes("Beatmap not found")) {
                console.log("Cannot process replay because the local map is older (or newer?) than the map used by the replay. This is not a problem, waiting for another job.")
                resolve({ success: false, error: "BEATMAP_NOT_FOUND" })
            }

            // we have a panic, since danser always exits after the panic and we need to get its logs we're resolving the promise in the process exit event
            if (data.split(" ")[2] === "panic:") isPanicking = true
            if (isPanicking) panicLogs += data // if danser has shown it's panicking, we're collecting new logs to have the full error

            if (data.includes("Error connecting to osu!api") && data.includes("invalid_client")) {
                abortDanserRender()
                console.log("It looks like your osu! OAuth keys are invalid! Please fix them before running the client.")
                resolve({ success: false, error: "BAD_OSU_OAUTH", exit: true })
            }
        })
        danserProcess.stderr.setEncoding("utf8")
        danserProcess.stderr.on("data", data => {
            // TODO: trigger these errors!
            if (data.includes("Invalid data found") || data.includes("strconv.ParseFloat")) {
                resolve({ success: false, error: "INVALID_DATA" })
                console.log("Found invalid data in the replay, it may be corrupted. Waiting for a new task.")
            }

            if (
                data.includes("Error initializing an internal MFX session: unsupported") || // when the intel encoder is set on a computer that doesn't support it
                data.includes("Cannot load libcuda.so") // when the nvidia encoder is set on a computer that doesn't support it
            ) {
                console.log('It looks like the wrong encoder was selected. Please change it in the client configuration (can be "cpu", "nvidia", or "intel").')
                resolve({ success: false, error: "NON_RENDER_ERROR", exit: true })
            }

            if (config.debug) {
                console.debug(data)
            } else if (data.includes("bitrate") && data.includes("frame") && !data.includes("version")) {
                console.log(data)
            }
        })
        danserProcess.on("exit", (code, signal) => {
            // TODO next ver: always send to the server that danser closed so we know that if the client shows no sign of life after a while danser has become stuck and the video will not be generated
            if (isPanicking) {
                console.log("An error occured. Waiting for another job, though you might want to check what happened in the crash report. This error has been automatically reported to o!rdr.")
                handlePanic(panicLogs)
                // danser always exits on panic so we can resolve here
                resolve({ success: false, error: "PANIC" })
            }

            if (signal === "SIGKILL") {
                if (abortReason) {
                    // danser was killed via abortRender
                    resolve({ success: false, error: `KILLED_${abortReason}` })
                } else {
                    resolve({ success: false, error: "KILLED_UNKNOWN" })
                }
                abortReason = null
            }
        })
    })

    // clearing the stuck check interval
    clearInterval(stuckCheckInterval)

    return renderResult
}

/**
 * @description Kill danser.
 * @param reason If specified, will set the global variable "abortReason" to this to be able to resolve the danser promise with it as the error
 */
export function abortDanserRender(reason?: TDanserAbortReason) {
    if (reason) abortReason = reason
    let killed = danserProcess.kill("SIGKILL")
    if (killed) {
        console.log("danser killed successfully. You may see FFmpeg errors but they should be harmless.")
    } else {
        console.log("danser not killed, not sure why. Maybe it already wasn't running?")
    }
}
