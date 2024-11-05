const uploadVideo = require("./uploadVideo")
var spawn = require("child_process").spawn
const { updatePresence } = require("./presence")
const fs = require("fs")
const { readConfig, exit } = require("./util")
let isRendering = false,
    danserProcess

exports.startDanser = async (danserArguments, videoName) => {
    let config = await readConfig()

    isRendering = true

    let canGetProgress = false
    let isPanicking = false
    let panicLogs = ""

    // stuckCheckInterval is the interval that will check if the video file danser is currently generating is growing or not.
    let tmpPath = `files/danser/videos/${videoName}_temp/`
    let lastVideoSize = 0
    let lastAudioSize = 0

    let stuckCheckInterval = setInterval(() => {
        if (!fs.existsSync(tmpPath + "video.mp4")) return

        let videoSize = fs.existsSync(tmpPath + "video.mp4") ? fs.statSync(tmpPath + "video.mp4").size : lastVideoSize + 1
        let audioSize = fs.existsSync(tmpPath + "audio.mp4") ? fs.statSync(tmpPath + "audio.mp4").size : lastAudioSize + 1

        if (videoSize <= lastVideoSize && audioSize <= lastAudioSize) {
            console.log("Seems like danser is stuck! Killing the process, waiting for a new task.")
            sendProgression("stuck")
            danserProcess.kill("SIGKILL")
            isRendering = false
            if (config.discordPresence) updatePresence("Idle", false)
        } else {
            lastVideoSize = videoSize
            lastAudioSize = audioSize
        }
    }, 30000)

    danserProcess = spawn("./danser", danserArguments, { cwd: "files/danser" })
    const { sendProgression, handlePanic } = require("./server")
    danserProcess.stdout.setEncoding("utf8")
    danserProcess.stdout.on(`data`, async data => {
        if (data.includes("Progress") && canGetProgress) {
            if (!config.showFullDanserLogs) {
                console.log(data)
            }
            sendProgression(data)
        }
        if (data.includes("Starting encoding")) canGetProgress = true
        if (data.includes("Finished.")) {
            clearInterval(stuckCheckInterval)
            console.log(`Rendering done.`)
            sendProgression("uploading")
            uploadVideo(videoName)
        }
        if (data.includes("Beatmap not found")) {
            clearInterval(stuckCheckInterval)
            sendProgression("beatmap_not_found")
            if (config.discordPresence) updatePresence("Idle", false)
            console.log("Cannot process replay because the local map is older (or newer?) than the map used by the replay. This is not a problem, waiting for another job.")
        }
        if (data.split(" ")[2] === "panic:") {
            clearInterval(stuckCheckInterval)
            isRendering = false
            sendProgression("panic")
            isPanicking = true
            if (config.discordPresence) updatePresence("Idle", false)
            let logString = "An error occured. Waiting for another job, though you might want to check what happened in the crash report."
            if (config.customServer.apiUrl === "") {
                console.log(logString)
            } else {
                console.log(logString + " This error has been automatically reported to o!rdr.")
            }
        }
        if (config.showFullDanserLogs) {
            console.log(data)
        }
        if (isPanicking) {
            panicLogs += data
        }
        if (data.includes("Error connecting to osu!api") && data.includes("invalid_client")) {
            clearInterval(stuckCheckInterval)
            await this.abortRender()
            isRendering = false
            sendProgression("bad_osu_oauth")
            if (config.discordPresence) updatePresence("Idle", false)
            console.log("It looks like your osu! OAuth keys are invalid! Please fix them before running the client.")
            await exit()
        }
    })
    danserProcess.stderr.setEncoding("utf8")
    danserProcess.stderr.on("data", data => {
        if (data.includes("Invalid data found") || data.includes("strconv.ParseFloat")) {
            clearInterval(stuckCheckInterval)
            isRendering = false
            sendProgression("invalid_data")
            if (config.discordPresence) updatePresence("Idle", false)
            console.log("Found invalid data in the replay, it may be corrupted. Waiting for a new task.")
        } else if (
            data.split(" ")[2] === "panic:" ||
            data.includes("Error initializing an internal MFX session: unsupported") || // when the intel encoder is set on a computer that doesn't support it
            data.includes("Cannot load libcuda.so") // when the nvidia encoder is set on a computer that doesn't support it
        ) {
            clearInterval(stuckCheckInterval)
            isRendering = false
            sendProgression("panic")
            if (config.discordPresence) updatePresence("Idle", false)
            console.log("An error occured with ffmpeg. Waiting for another job.")
        }

        if (config.showFullFFmpegLogs) {
            console.log(data)
        } else if (data.includes("bitrate") && data.includes("frame") && !data.includes("version")) {
            console.log(data)
        }
    })
    danserProcess.on("exit", () => {
        if (isPanicking) handlePanic(panicLogs)
    })
}

exports.isRendering = value => {
    if (typeof value !== "boolean") {
        return isRendering
    } else {
        isRendering = value
    }
}

exports.abortRender = async () => {
    let killed = await danserProcess.kill("SIGKILL")
    if (killed) {
        console.log("danser killed successfully. You may see FFmpeg errors but they should be harmless.")
    } else {
        console.log("danser not killed, not sure why. Maybe it already wasn't running?")
    }
}
