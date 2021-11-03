const uploadVideo = require("./uploadVideo")
let isRendering = false,
    danserProcess

exports.startDanser = async (danserArguments, videoName) => {
    isRendering = true

    const config = require(process.cwd() + "/config.json")
    var spawn = require("child_process").spawn
    let danserPath
    if (process.platofrm === "win32") {
        danserPath = `${process.cwd()}/files/danser/danser.exe`
    } else {
        danserPath = `${process.cwd()}/files/danser/danser`
    }
    danserProcess = spawn(danserPath, danserArguments)
    const { sendProgression, reportPanic } = require("./server")
    danserProcess.stdout.setEncoding("utf8")
    danserProcess.stdout.on(`data`, data => {
        if (data.includes("Progress")) {
            if (!config.showFullDanserLogs) {
                console.log(data)
            }
            sendProgression(data)
        }
        if (data.includes("Finished.")) {
            console.log(`Rendering done.`)
            sendProgression("uploading")
            uploadVideo(videoName)
        }
        if (data.includes("Beatmap not found")) {
            sendProgression("beatmap_not_found")
            console.log("Cannot process replay because the local map is older (or newer?) than the map used by the replay. This is not a problem, waiting for another job.")
        }
        if (data.includes("panic")) {
            sendProgression("panic")
            reportPanic(data)
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
        if (data.includes("Invalid data found")) {
            sendProgression("invalid_data")
            console.log()
        }
        if (data.includes("panic")) {
            sendProgression("panic")
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
