const uploadVideo = require("./uploadVideo")
let isRendering = false

exports.startDanser = async (danserArguments, videoName) => {
    isRendering = true

    const config = require("../config.json")
    var spawn = require("child_process").spawn
    const danser = spawn(config.danserPath, danserArguments)
    const { sendProgression, reportPanic } = require("./server")

    danser.stdout.setEncoding("utf8")
    danser.stdout.on(`data`, data => {
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
            console.log("Cannot process replay. This is not a Danser problem, waiting for another job.")
        }
        if (data.includes("panic")) {
            sendProgression("panic")
            reportPanic(data)
            console.log("An error occured. Waiting for another job.")
        }
        if (config.showFullDanserLogs) {
            console.log(data)
        }
    })
    danser.stderr.setEncoding("utf8")
    danser.stderr.on("data", data => {
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
