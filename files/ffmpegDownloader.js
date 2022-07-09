const path = require("path")
const wget = require("wget-improved")
const unzipper = require("unzipper")
const fs = require("fs")
const config = require(process.cwd() + "/config.json")
const { startServer } = require("./server")
const settingsGenerator = require("./settingsGenerator")
const { exit } = require("./util")

module.exports = async cb => {
    var link
    if (process.platform === "win32") {
        link = `https://github.com/JinPots/idk/releases/download/ffmpeg/ffmpeg-win.zip`
    } else {
        link = `https://github.com/JinPots/idk/releases/download/ffmpeg/ffmpeg.zip`
    }
    const output = path.resolve("files/danser/ffmpeg.zip")
    let download = wget.download(link, output)
    download.on("error", err => {
        console.log(err)
    })
    download.on("start", fileSize => {
        console.log(`Downloading ffmpeg at ${link}: ${fileSize} bytes to download...`)
    })
    download.on("end", () => {
        try {
            fs.createReadStream(output)
                .pipe(
                    unzipper.Extract({
                        path: `files/danser`
                    })
                )
                .on("close", () => {
                    console.log(`Finished downloading danser.`)
                    if (config.id) {
                        startServer()
                    } else {
                        settingsGenerator("new")
                    }
                    if (process.platform === "linux") {
                        fs.chmodSync("files/danser/ffmpeg", "755")
                    }
                    if (cb) {
                        cb()
                    }
                })
        } catch (err) {
            console.log("An error occured while unpacking FFmpeg: " + err)
            exit()
        }
    })
}
