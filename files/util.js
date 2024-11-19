const wget = require("wget-improved")
const AdmZip = require("adm-zip")
const fs = require("fs")
const crypto = require("crypto")

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
            console.log(`An error occured while downloading ${link}:`, err)
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
    osuOauthClientId: "",
    osuOauthClientSecret: "",
    motionBlurCapable: false,
    uhdCapable: false,
    debugLogs: false,
    customServer: {
        clientUrl: "",
        apiUrl: ""
    },
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

exports.updateConfig = async () => {
    let currentConfig = await this.readConfig()
    if (typeof currentConfig.usingOsuApi !== "undefined") {
        if (currentConfig.osuApiKey !== "") console.log("You were using an osu! API v1 key with the o!rdr client.")
        console.log("danser now uses the osu! API v2 to retrieve leaderboards, so you'll need to use an OAuth key that you can get on the osu! website: https://osu.ppy.sh/home/account/edit (OAuth section) if you want your client to be able to render videos requiring a scoreboard.")
        console.log('The "Application Callback URLs" field can be left empty, but if you want your client config to be future-proof you should enter this: http://localhost:8294')
        delete currentConfig.usingOsuApi
        delete currentConfig.osuApiKey
        currentConfig.osuOauthClientId = ""
        currentConfig.osuOauthClientSecret = ""
        fs.writeFileSync(process.cwd() + "/config.json", JSON.stringify(currentConfig, null, 2), { encoding: "utf-8" })
    }
}

exports.getMd5 = async path => {
    return await new Promise(async (resolve, _) => {
        const input = fs.createReadStream(path)
        const hash = crypto.createHash("md5")
        input.on("readable", async () => {
            const data = input.read()
            if (data) {
                hash.update(data)
            } else {
                resolve(hash.digest("hex"))
            }
        })
    })
}
