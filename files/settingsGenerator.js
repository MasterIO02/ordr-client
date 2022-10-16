var spawn = require("child_process").spawn
const config = require(process.cwd() + "/config.json")
const fs = require("fs")
const { asyncDownload, asyncExtract } = require("./util")

module.exports = async (type, resolution, turbo, cb) => {
    if (type === "new") {
        if (!fs.existsSync("files/danser/Songs")) fs.mkdirSync("files/danser/Songs")
        if (!fs.existsSync("files/danser/Skins")) fs.mkdirSync("files/danser/Skins", { recursive: true })
        if (!fs.existsSync("files/danser/rawReplays")) fs.mkdirSync("files/danser/rawReplays")
        if (!fs.existsSync("files/danser/videos")) fs.mkdirSync("files/danser/videos")
    } else if (type === "change") {
        if (config.usingOsuApi) {
            const danserCredentials = require(process.cwd() + "/files/danser/settings/credentials.json")
            if (danserCredentials.ApiV1Key !== config.osuApiKey) {
                danserCredentials.ApiV1Key = config.osuApiKey
                fs.writeFileSync("files/danser/settings/credentials.json", JSON.stringify(danserCredentials, null, 1), "utf-8", err => {
                    if (err) throw err
                })
            }
        }

        if (!fs.existsSync("files/danser/Skins/default_fallback")) {
            await asyncDownload("https://dl.issou.best/ordr/default_fallback_skin.zip", "files/danser/Skins/default_fallback.zip", "default_fallback_skin", "skin")
            await asyncExtract("files/danser/Skins/default_fallback.zip", "files/danser/Skins/default_fallback", "default_fallback", "skin")
        }

        if (fs.existsSync(`${process.cwd()}/files/danser/settings/default.json`)) {
            await fs.promises.unlink(`${process.cwd()}/files/danser/settings/default.json`, err => {
                if (err) throw err
            })
        }
        // using -settings= argument to not trigger the rickroll
        spawn("./danser", ["-settings=", "-noupdatecheck"], { cwd: "files/danser" }).addListener("exit", () => {
            const danserConfig = require(process.cwd() + "/files/danser/settings/default.json")
            function writeDanserConfig() {
                fs.writeFileSync("files/danser/settings/default.json", JSON.stringify(danserConfig, null, 1), "utf-8", err => {
                    if (err) throw err
                })
            }

            if (config.customSongsFolderPath !== "") {
                danserConfig.General.OsuSongsDir = config.customSongsFolderPath
            } else {
                danserConfig.General.OsuSongsDir = process.cwd() + "/files/danser/Songs"
            }
            danserConfig.General.OsuSkinsDir = process.cwd() + "/files/danser/Skins"
            switch (config.encoder) {
                case "cpu":
                    danserConfig.Recording.Encoder = "libx264"
                    if (turbo) {
                        danserConfig.Recording.libx264.CRF = 51
                        danserConfig.Recording.libx264.Preset = "ultrafast"
                        danserConfig.Recording.libx264.AdditionalOptions = "-g 450"
                    } else {
                        danserConfig.Recording.libx264.CRF = 21
                        danserConfig.Recording.libx264.Preset = "faster"
                        danserConfig.Recording.libx264.AdditionalOptions = "-g 450"
                    }
                    break
                case "nvidia":
                    danserConfig.Recording.Encoder = "h264_nvenc"
                    if (turbo) {
                        danserConfig.Recording.h264_nvenc.RateControl = "cqp"
                        danserConfig.Recording.h264_nvenc.CQ = 51
                        danserConfig.Recording.h264_nvenc.Preset = "p1"
                        danserConfig.Recording.h264_nvenc.AdditionalOptions = "-g 450"
                    } else {
                        danserConfig.Recording.h264_nvenc.RateControl = "cqp"
                        danserConfig.Recording.h264_nvenc.CQ = 26
                        danserConfig.Recording.h264_nvenc.Preset = "p7"
                        danserConfig.Recording.h264_nvenc.AdditionalOptions = "-g 450"
                    }
                    break
                case "intel":
                    danserConfig.Recording.Encoder = "h264_qsv"
                    if (turbo) {
                        danserConfig.Recording.h264_qsv.ICQ = 51
                        danserConfig.Recording.h264_qsv.Preset = "veryfast"
                        danserConfig.Recording.h264_qsv.AdditionalOptions = "-g 450"
                    } else {
                        // -global_quality was 31 before and looked okay-ish on 1080p but very bad on 720p
                        if (resolution === "1920x1080" || resolution === "3840x2160") {
                            danserConfig.Recording.h264_qsv.Quality = 28
                            danserConfig.Recording.h264_qsv.AdditionalOptions = "-g 450"
                        } else {
                            danserConfig.Recording.h264_qsv.Quality = 25
                            danserConfig.Recording.h264_qsv.AdditionalOptions = "-g 450"
                        }
                        danserConfig.Recording.h264_qsv.Preset = "veryslow"
                    }
                    break
            }
            if (resolution === "3840x2160") {
                danserConfig.Recording.Filters = "scale=3840:2160:flags=lanczos"
            } else {
                danserConfig.Recording.Filters = ""
            }
            writeDanserConfig()
            if (cb) cb()
        })
    }
}
