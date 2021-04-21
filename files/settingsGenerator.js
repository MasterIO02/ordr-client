module.exports = settingsGenerator = async (type) => {
    var spawn = require('child_process').spawn
    const config = require('../config.json')
    const fs = require('fs')
    const path = require('path')

    async function writeDanserConfig() {
        const danserConfig = require('./danser/settings.json')
        fs.writeFileSync('files/danser/settings.json', JSON.stringify(danserConfig, null, 1), 'utf-8', (err) => {
            if (err) throw err
        })
    }

    if (type === "new") {
        setTimeout(() => {
            fs.mkdirSync('files/danser/Songs')
            fs.mkdirSync('files/danser/Skins')
            fs.mkdirSync('files/danser/rawReplays')
            fs.mkdirSync('files/danser/videos')
            config.danserSongsDir = path.resolve("files/danser/Songs")
            config.danserSkinsDir = path.resolve("files/danser/Skins")
            config.rawReplaysPath = path.resolve("files/danser/rawReplays")
            config.videosPath = path.resolve("files/danser/videos")
            if (process.platform === "win32") {
                config.danserPath = path.resolve("files/danser/danser.exe")
            } else {
                config.danserPath = path.resolve("files/danser/danser")
            }
            config.settingsPath = path.resolve("files/danser/settings.json")
            fs.writeFileSync('./config.json', JSON.stringify(config, null, 1), 'utf-8', (err) => {
                if (err) throw err
            })
        }, 1000)
    } else if (type === "change") {
        if (config.usingOsuApi) {
            if (!fs.existsSync('files/danser/api.txt')) {
                fs.writeFileSync('files/danser/api.txt', config.osuApiKey, 'utf-8', (err) => {
                    if (err) throw err
                })
            }
            const currentApi = fs.readFileSync('files/danser/api.txt', 'utf-8')
            if (currentApi !== config.osuApiKey) {
                fs.writeFileSync('files/danser/api.txt', config.osuApiKey, 'utf-8', (err) => {
                    if (err) throw err
                })
            }
        }
        if (fs.existsSync(config.settingsPath)) {
            await fs.promises.unlink(config.settingsPath, (err) => {
                if (err) throw err
            })
        }
        // using -settings= argument to not trigger the rickroll
        var arguments = ['-settings=']
        spawn('files/danser/danser', arguments)
        setTimeout(() => {
            const danserConfig = require('./danser/settings.json')
            danserConfig.General.OsuSongsDir = config.danserSongsDir
            danserConfig.General.OsuSkinsDir = config.danserSkinsDir

            switch (true) {
                case config.encoder === "cpu":
                    danserConfig.Recording.Encoder = "libx264"
                    danserConfig.Recording.EncoderOptions = "-crf 20"
                    danserConfig.Recording.Preset = "fast"
                    writeDanserConfig()
                    break
                case config.encoder === "nvidia":
                    danserConfig.Recording.Encoder = "h264_nvenc"
                    danserConfig.Recording.EncoderOptions = "-rc constqp -qp 20"
                    danserConfig.Recording.Preset = "slow"
                    writeDanserConfig()
                    break
                case config.encoder === "amd":
                    danserConfig.Recording.Encoder = "h264_amf"
                    danserConfig.Recording.EncoderOptions = "-rc cqp -qp_p 17 -qp_i 17"
                    danserConfig.Recording.Preset = "slow"
                    writeDanserConfig()
                    break
            }
            writeDanserConfig()
        }, 4000)

    }
}