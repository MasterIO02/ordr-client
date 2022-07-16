const path = require("path")
const wget = require("wget-improved")
const unzipper = require("unzipper")
const fs = require("fs")
const config = require(process.cwd() + "/config.json")
const { startServer } = require("./server")
const { exit } = require("./util")

module.exports = async cb => {
    var link
    if (process.platform === "win32") {
        link = `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip`
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
                    console.log(`Finished downloading FFmpeg.`)
                    fs.renameSync('files/danser/ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe', 'files/danser/ffmpeg.exe')
                    fs.rmSync('files/danser/ffmpeg-master-latest-win64-gpl', {
                        recursive: true
                    })
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
