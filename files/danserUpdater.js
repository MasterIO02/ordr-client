const path = require("path")
const fs = require("fs")
const inquirer = require("inquirer")
const settingsGenerator = require("./settingsGenerator")
const { asyncDownload, asyncExtract, readConfig } = require("./util")
const { spawn } = require("child_process")

module.exports = async (cb, version) => {
    let config = await readConfig()

    let link, filename
    if (process.platform === "win32") {
        link = `https://github.com/Wieku/danser-go/releases/download/${version}/danser-${version}-win.zip`
        filename = `danser-${version}-win.zip`
    } else {
        link = `https://github.com/Wieku/danser-go/releases/download/${version}/danser-${version}-linux.zip`
        filename = `danser-${version}-linux.zip`
    }
    let { confirmedDownload } = await inquirer.prompt({
        name: "confirmedDownload",
        type: "confirm",
        message: "WARNING: a danser update needs to be made. The o!rdr client will now download external non MIT-licensed binaries. Do you want to proceed?",
        default: true
    })
    if (confirmedDownload) {
        const output = path.resolve("files/danser/danser.zip")
        await asyncDownload(link, output, filename, "file")
        await asyncExtract(output, "files/danser", filename, "file")

        if (process.platform === "linux") {
            fs.rmSync("files/danser/danser")
            fs.renameSync("files/danser/danser-cli", "files/danser/danser")
            fs.chmodSync("files/danser/danser", "755")
        } else {
            fs.rmSync("files/danser/danser.exe")
            fs.renameSync("files/danser/danser-cli.exe", "files/danser/danser.exe")
        }

        await settingsGenerator("new")
        spawn("./danser", ["-settings=", "-noupdatecheck"], { cwd: "files/danser" }).addListener("exit", () => {
            cb()
        })
    } else {
        process.exit(0)
    }
}
