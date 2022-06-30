const uploadVideo = require("./uploadVideo")
const config = require(process.cwd() + "/config.json")
var spawn = require("child_process").spawn
const { updatePresence } = require("./presence")
let isRendering = false,
    danserProcess

exports.startDanser = async (danserArguments, videoName) => {
    isRendering = true

    let danserStuckTimeout,
        clearedTimeout = false
    function resetStuckDanserTimeout() {
        clearTimeout(danserStuckTimeout)
        if (!clearedTimeout) {
            danserStuckTimeout = setTimeout(() => {
                console.log("Seems like danser is stuck! Killing the process, waiting for a new task.")
                sendProgression("stuck")
                danserProcess.kill("SIGKILL")
                isRendering = false
                if (config.discordPresence) updatePresence("Idle", false)
            }, 30000)
        }
    }
    resetStuckDanserTimeout()

    function clearDanserStuckTimeout() {
        clearedTimeout = true
        clearTimeout(danserStuckTimeout)
    }

    danserProcess = spawn(`files/danser/danser`, danserArguments)
    const { sendProgression, reportPanic } = require("./server")
    danserProcess.stdout.setEncoding("utf8")
    danserProcess.stdout.on(`data`, data => {
        resetStuckDanserTimeout()
        if (data.includes("Progress")) {
            if (!config.showFullDanserLogs) {
                console.log(data)
            }
            sendProgression(data)
        }
        if (data.includes("Finished.")) {
            clearDanserStuckTimeout()
            console.log(`Rendering done.`)
            sendProgression("uploading")
            uploadVideo(videoName)
        }
        if (data.includes("Beatmap not found")) {
            clearDanserStuckTimeout()
            sendProgression("beatmap_not_found")
            if (config.discordPresence) updatePresence("Idle", false)
            console.log("Cannot process replay because the local map is older (or newer?) than the map used by the replay. This is not a problem, waiting for another job.")
        }
        if (data.includes("panic")) {
            clearDanserStuckTimeout()
            isRendering = false
            sendProgression("panic")
            reportPanic(data)
            if (config.discordPresence) updatePresence("Idle", false)
            let logString = "An error occured. Waiting for another job, though you might want to check what happened in the danser.log file."
            if (config.customServer.apiUrl === "") {
                console.log(logString)
            } else {
                console.log(logString + " This error has been automatically reported to o!rdr.")
            }
        }
        if (config.showFullDanserLogs) {
            console.log(data)
        }
    })
    danserProcess.stderr.setEncoding("utf8")
    danserProcess.stderr.on("data", data => {
        resetStuckDanserTimeout()
        if (data.includes("Invalid data found") || data.includes("strconv.ParseFloat")) {
            isRendering = false
            clearDanserStuckTimeout()
            sendProgression("invalid_data")
            if (config.discordPresence) updatePresence("Idle", false)
            console.log("Found invalid data in the replay, it may be corrupted. Waiting for a new task.")
        } else if (data.includes("panic")) {
            isRendering = false
            clearDanserStuckTimeout()
            sendProgression("panic")
            if (config.discordPresence) updatePresence("Idle", false)
            console.log("An error occured. Waiting for another job.")
        }

        if (config.showFullFFmpegLogs) {
            console.log(data)
        } else if (data.includes("bitrate") && data.includes("frame") && !data.includes("version")) {
            console.log(data)
        }
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
