const path = require("path")
const wget = require("wget-improved")
const fs = require("fs")
const config = require(process.cwd() + "/config.json")
const { startServer } = require("./server")
const settingsGenerator = require("./settingsGenerator")
const { exit } = require("./util")
const AdmZip = require("adm-zip");

module.exports = async cb => {
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
        console.log(`Downloading danser at ${link}: ${fileSize} bytes to download...`)
    })
    download.on("end", () => {
        try {
            const zip = new AdmZip(output);
            zip.extractAllTo("files/danser");

            console.log(`Finished downloading danser.`)
            if (config.id) {
                startServer()
            } else {
                settingsGenerator("new")
            }
            if (process.platform === "linux") {
                fs.chmodSync("files/danser/danser", "755")
            }
            if (cb) {
                cb()
            }
        } catch (err) {
            console.log("An error occured while unpacking Danser: " + err)
            exit()
        }
    })
}
