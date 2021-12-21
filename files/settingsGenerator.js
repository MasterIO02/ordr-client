var spawn = require("child_process").spawn
const config = require(process.cwd() + "/config.json")
const fs = require("fs")

module.exports = async (type, resolution, cb) => {
    if (type === "new") {
        fs.mkdirSync("files/danser/Songs")
        fs.mkdirSync("files/danser/Skins", { recursive: true })
        fs.mkdirSync("files/danser/rawReplays")
        fs.mkdirSync("files/danser/videos")
    } else if (type === "change") {
        if (config.usingOsuApi) {
            if (!fs.existsSync("files/danser/api.txt")) {
                fs.writeFileSync("files/danser/api.txt", config.osuApiKey, "utf-8", err => {
                    if (err) throw err
                })
            }
            const currentApi = fs.readFileSync("files/danser/api.txt", "utf-8")
            if (currentApi !== config.osuApiKey) {
                fs.writeFileSync("files/danser/api.txt", config.osuApiKey, "utf-8", err => {
                    if (err) throw err
                })
            }
        }
        if (fs.existsSync(`${process.cwd()}/files/danser/settings/default.json`)) {
            await fs.promises.unlink(`${process.cwd()}/files/danser/settings/default.json`, err => {
                if (err) throw err
            })
        }
        // using -settings= argument to not trigger the rickroll
        var danserArguments = ["-settings="]
        spawn("files/danser/danser", danserArguments).addListener("exit", () => {
            const danserConfig = require(process.cwd() + "/files/danser/settings/default.json")
            function writeDanserConfig() {
                fs.writeFileSync("files/danser/settings/default.json", JSON.stringify(danserConfig, null, 1), "utf-8", err => {
                    if (err) throw err
                })
            }

            danserConfig.General.OsuSongsDir = process.cwd() + "/files/danser/Songs"
            danserConfig.General.OsuSkinsDir = process.cwd() + "/files/danser/Skins"
            switch (config.encoder) {
                case "cpu":
                    danserConfig.Recording.Encoder = "libx264"
                    danserConfig.Recording.EncoderOptions = "-crf 21 -g 450"
                    danserConfig.Recording.Preset = "faster"
                    break
                case "nvidia":
                    danserConfig.Recording.Encoder = "h264_nvenc"
                    danserConfig.Recording.EncoderOptions = "-rc constqp -qp 26 -g 450"
                    danserConfig.Recording.Preset = "p7"
                    break
                case "amd":
                    danserConfig.Recording.Encoder = "h264_amf"
                    danserConfig.Recording.EncoderOptions = "-rc cqp -qp_p 17 -qp_i 17 -quality quality"
                    danserConfig.Recording.Preset = "slow" // H264_amf doesn't support -preset, instead using -quality (for some reason), keeping preset so it doesn't break anything
                    break
                case "intel":
                    danserConfig.Recording.Encoder = "h264_qsv"
                    // -global_quality was 31 before and looked okay-ish on 1080p but very bad on 720p
                    if (resolution === "1920x1080" || resolution === "3840x2160") {
                        danserConfig.Recording.EncoderOptions = "-global_quality 28 -g 450"
                    } else {
                        danserConfig.Recording.EncoderOptions = "-global_quality 26 -g 450"
                    }
                    danserConfig.Recording.Preset = "veryslow"
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
