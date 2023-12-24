const wget = require("wget-improved")
const AdmZip = require("adm-zip")
const fs = require("fs")

exports.exit = async () => {
    process.stdin.setRawMode(true)
    process.stdin.resume()

    console.log("Press any key to exit.")

    await new Promise(resolve => {
        process.stdin.once("data", () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            resolve()
            process.exit(0)
        })
    })
}

exports.asyncDownload = async (link, output, filename, type) => {
    await new Promise((resolve, reject) => {
        let download = wget.download(link, output)

        download.on("error", async err => {
            console.log(err)
            await this.exit()
            reject()
        })
        download.on("start", fileSize => {
            console.log(`Downloading ${type} ${filename} at ${link}: ${fileSize} bytes to download...`)
        })
        download.on("end", () => {
            console.log(`Finished downloading ${type} ${filename}.`)
            resolve()
        })
    })
}

exports.asyncExtract = async (input, output, filename, type) => {
    await new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(input)
            zip.extractAllTo(output, true) // overwriting is required to update danser and the maps
            fs.unlinkSync(input)
            if (filename !== "librespeed") console.log(`Finished unpacking ${type} ${filename}.`)
            resolve()
        } catch (err) {
            console.log(`An error occured while unpacking ${type}`, err)
            ;async () => {
                this.exit()
            }
            reject()
        }
    })
}

let emptyConfig = {
    id: "",
    encoder: "",
    usingOsuApi: false,
    osuApiKey: "",
    motionBlurCapable: false,
    uhdCapable: false,
    debugLogs: false,
    customServer: {
        clientUrl: "",
        apiUrl: ""
    },
    needUpdate: false,
    deleteRenderedVideos: true,
    showFullDanserLogs: true,
    showFullFFmpegLogs: true,
    renderOnInactivityOnly: false,
    relay: "direct",
    customSongsFolderPath: "",
    logTimestamps: false,
    discordPresence: false,
    customization: {
        textColor: "",
        backgroundType: 0
    }
}

exports.readConfig = async () => {
    if (!fs.existsSync(process.cwd() + "/config.json")) {
        fs.writeFileSync(process.cwd() + "/config.json", JSON.stringify(emptyConfig, null, 2), { encoding: "utf-8" })
    }

    return JSON.parse(fs.readFileSync(process.cwd() + "/config.json", { encoding: "utf-8" }))
}

exports.writeConfig = async (key, value) => {
    if (!fs.existsSync(process.cwd() + "/config.json")) {
        fs.writeFileSync(process.cwd() + "/config.json", JSON.stringify(emptyConfig, null, 2), { encoding: "utf-8" })
    }

    let config = JSON.parse(fs.readFileSync(process.cwd() + "/config.json", { encoding: "utf-8" }))
    config[key] = value
    fs.writeFileSync(process.cwd() + "/config.json", JSON.stringify(config, null, 2), { encoding: "utf-8" })
    return config
}
