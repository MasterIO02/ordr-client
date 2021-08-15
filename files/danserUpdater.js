const path = require("path")
const wget = require("wget-improved")
const unzipper = require("unzipper")
const fs = require("fs")
const config = require("../config.json")
const { startServer } = require("./server")
const settingsGenerator = require("./settingsGenerator")

module.exports = async () => {
    var link
    if (process.platform === "win32") {
        link = `https://dl.issou.best/ordr/danser-latest-win.zip`
    } else {
        link = `https://dl.issou.best/ordr/danser-latest-linux.zip`
    }
    const output = path.resolve("files/danser/danser.zip")
    let download = wget.download(link, output)
    download.on("error", err => {
        console.log(err)
    })
    download.on("start", fileSize => {
        console.log(`Downloading Danser at ${link}: ${fileSize} bytes to download...`)
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
                    console.log(`Finished downloading Danser.`)
                    if (config.id) {
                        startServer()
                    } else {
                        settingsGenerator("new")
                    }
                    if (process.platform === "linux") {
                        fs.chmodSync("files/danser/danser", "755")
                    }
                })
        } catch (err) {
            console.log("An error occured while unpacking Danser: " + err)
            process.exit(1)
        }
    })
}
