module.exports = async data => {
    const fs = require("fs")
    const wget = require("wget-improved")
    const config = require("../config.json")
    const { sendProgression } = require("./server")
    const settingsGenerator = require("./settingsGenerator")

    async function writeDanserConfig(danserConfig) {
        fs.writeFileSync("files/danser/settings/default.json", JSON.stringify(danserConfig, null, 1), "utf-8", err => {
            if (err) throw err
        })
    }

    if (data.skin !== "default" && config.customServer.apiUrl === "") {
        if (fs.existsSync(`${config.danserSkinsDir}/${data.skin}`)) {
            console.log(`Skin ${data.skin} is present.`)
            downloadReplay()
        } else {
            const link = `https://dl.issou.best/ordr/skins/${data.skin}.osk`
            const output = `${config.danserSkinsDir}/${data.skin}.osk`
            let download = wget.download(link, output)
            download.on("error", err => {
                console.log(err)
                process.exit()
            })
            download.on("start", fileSize => {
                console.log(`Downloading the ${data.skin} skin at ${link}: ${fileSize} bytes to download...`)
            })
            download.on("end", () => {
                console.log(`Finished downloading ${data.skin}. Unpacking it now.`)
                const unzipper = require("unzipper")
                try {
                    fs.createReadStream(output)
                        .pipe(
                            unzipper.Extract({
                                path: `${config.danserSkinsDir}/${data.skin}`
                            })
                        )
                        .on("close", () => {
                            console.log(`Finished unpacking ${data.skin}.`)
                            fs.rmSync(output)
                            downloadReplay()
                        })
                } catch (err) {
                    console.log("An error occured while unpacking the skin: " + err)
                }
            })
        }
    } else {
        downloadReplay()
    }

    var replayFilename
    async function downloadReplay() {
        const link = data.replayFilePath
        replayFilename = link.split("/").pop()
        const output = `${config.rawReplaysPath}/${replayFilename}`
        let download = wget.download(link, output)
        download.on("error", err => {
            console.log(err)
            process.exit()
        })
        download.on("start", fileSize => {
            console.log(`Downloading the replay at ${link}: ${fileSize} bytes to download...`)
        })
        download.on("end", () => {
            console.log(`Finished downloading the replay.`)
            downloadMap()
        })
    }

    async function downloadMap() {
        const link = data.mapLink
        var filename = link.split("/").pop().split(".")[0]
        if (fs.existsSync(`${config.danserSongsDir}/${filename}`) && !data.needToRedownload) {
            console.log(`Map ${filename} is present.`)
            settingsGenerator("change", () => {
                changeConfig()
            })
        } else {
            if (data.needToRedownload) {
                console.log("A beatmap update is available.")
            }
            const output = `${config.danserSongsDir}/${filename}.osz`
            let download = wget.download(link, output)
            download.on("start", fileSize => {
                console.log(`Downloading the map at ${link}: ${fileSize} bytes to download...`)
            })
            download.on("end", () => {
                console.log(`Finished downloading the map.`)
                settingsGenerator("change", () => {
                    changeConfig()
                })
            })
            download.on("error", err => {
                console.log(err)
                sendProgression("download_404")
                console.log("Beatmap from the mirror not found. Skipping this render and marking it as failed.")
            })
        }
    }

    async function changeConfig() {
        const danserConfig = require("./danser/settings/default.json")

        var resolution = data.resolution.split(" ")[0].split("x")
        danserConfig.Recording.FrameWidth = Number(resolution[0])
        danserConfig.Recording.FrameHeight = Number(resolution[1])

        if (data.resolution == "640x480") {
            danserConfig.Recording.FPS = 30
        } else {
            danserConfig.Recording.FPS = 60
        }

        if (data.globalVolume === 100) {
            danserConfig.Audio.GeneralVolume = 1
        } else {
            danserConfig.Audio.GeneralVolume = Number("0." + data.globalVolume)
        }

        if (data.musicVolume === 100) {
            danserConfig.Audio.MusicVolume = 1
        } else {
            danserConfig.Audio.MusicVolume = Number("0." + data.musicVolume)
        }

        if (data.hitsoundVolume === 100) {
            danserConfig.Audio.SampleVolume = 1
        } else {
            danserConfig.Audio.SampleVolume = Number("0." + data.hitsoundVolume)
        }

        danserConfig.Audio.IgnoreBeatmapSamples = data.useSkinHitsounds

        danserConfig.Gameplay.HitErrorMeter.Show = data.showHitErrorMeter
        danserConfig.Gameplay.HitErrorMeter.ShowUnstableRate = data.showUnstableRate
        danserConfig.Gameplay.Score.Show = data.showScore
        danserConfig.Gameplay.HpBar.Show = data.showHPBar
        danserConfig.Gameplay.ComboCounter.Show = data.showComboCounter
        danserConfig.Gameplay.PPCounter.Show = data.showPPCounter
        danserConfig.Gameplay.KeyOverlay.Show = data.showKeyOverlay
        danserConfig.Gameplay.ScoreBoard.Show = data.showScoreboard
        danserConfig.Gameplay.HitCounter.Show = data.showHitCounter

        if (data.showScoreboard) {
            danserConfig.Gameplay.ScoreBoard.HideOthers = false
            danserConfig.Gameplay.ScoreBoard.ShowAvatars = true
        } else {
            danserConfig.Gameplay.ScoreBoard.HideOthers = true
            danserConfig.Gameplay.ScoreBoard.ShowAvatars = false
        }

        danserConfig.Gameplay.Boundaries.Enabled = data.showBorders
        danserConfig.Gameplay.Mods.Show = data.showMods
        danserConfig.Gameplay.ShowResultsScreen = data.showResultScreen

        danserConfig.Skin.CurrentSkin = data.skin
        danserConfig.Skin.Cursor.UseSkinCursor = data.useSkinCursor

        if (data.useSkinColors) {
            danserConfig.Skin.UseBeatmapColors = false
            danserConfig.Skin.UseColorsFromSkin = true
        }

        if (data.useBeatmapColors) {
            danserConfig.Skin.UseBeatmapColors = true
            danserConfig.Skin.UseColorsFromSkin = true
        }

        danserConfig.Cursor.ScaleToCS = data.cursorScaleToCS
        danserConfig.Cursor.Colors.EnableRainbow = data.cursorRainbow
        danserConfig.Cursor.EnableTrailGlow = data.cursorTrailGlow
        danserConfig.Skin.Cursor.Scale = data.cursorSize

        if (data.cursorTrail && !data.hasCursorMiddle) {
            danserConfig.Skin.Cursor.ForceLongTrail = false
        } else if (data.cursorTrail && data.hasCursorMiddle) {
            danserConfig.Skin.Cursor.ForceLongTrail = false
            danserConfig.Skin.Cursor.LongTrailDensity = 1
            danserConfig.Skin.Cursor.LongTrailLength = 2048
        } else {
            danserConfig.Skin.Cursor.ForceLongTrail = true
            danserConfig.Skin.Cursor.LongTrailDensity = 0
            danserConfig.Skin.Cursor.LongTrailLength = 0
        }

        danserConfig.Objects.DrawFollowPoints = data.drawFollowPoints
        danserConfig.Objects.DrawComboNumbers = data.drawComboNumbers

        danserConfig.Objects.ScaleToTheBeat = data.scaleToTheBeat
        danserConfig.Objects.Sliders.SliderMerge = data.sliderMerge

        if (data.objectsRainbow) {
            danserConfig.UseBeatmapColors = false
            danserConfig.Skin.UseColorsFromSkin = false
            danserConfig.Objects.Colors.Color.EnableRainbow = true
        }

        danserConfig.Objects.Colors.Sliders.Border.Color.FlashToTheBeat = data.objectsFlashToTheBeat
        danserConfig.Objects.Colors.Sliders.Body.Color.FlashToTheBeat = data.objectsFlashToTheBeat
        danserConfig.Playfield.Background.FlashToTheBeat = data.objectsFlashToTheBeat

        danserConfig.Objects.Colors.Sliders.Body.UseHitCircleColor = data.useHitCircleColor

        danserConfig.Playfield.SeizureWarning.Enabled = data.seizureWarning
        danserConfig.Playfield.Background.LoadStoryboards = data.loadStoryboard
        danserConfig.Playfield.Background.LoadVideos = data.loadVideo

        if (data.introBGDim === 100) {
            danserConfig.Playfield.Background.Dim.Intro = 1
        } else {
            danserConfig.Playfield.Background.Dim.Intro = Number("0." + data.introBGDim)
        }
        if (data.inGameBGDim === 100) {
            danserConfig.Playfield.Background.Dim.Normal = 1
        } else {
            danserConfig.Playfield.Background.Dim.Normal = Number("0." + data.inGameBGDim)
        }

        if (data.breakBGDim === 100) {
            danserConfig.Playfield.Background.Dim.Breaks = 1
        } else {
            danserConfig.Playfield.Background.Dim.Breaks = Number("0." + data.breakBGDim)
        }

        if (data.BGParallax) {
            danserConfig.Playfield.Background.Parallax.Amount = 0.1
        } else {
            danserConfig.Playfield.Background.Parallax.Amount = 0
        }

        if (data.showDanserLogo) {
            danserConfig.Playfield.Logo.Dim.Intro = 0
        } else {
            danserConfig.Playfield.Logo.Dim.Intro = 1
        }

        danserConfig.Cursor.CursorRipples = data.cursorRipples
        danserConfig.Objects.Sliders.Snaking.In = data.sliderSnakingIn
        danserConfig.Objects.Sliders.Snaking.Out = data.sliderSnakingOut

        if (data.motionBlur960fps) {
            danserConfig.Recording.MotionBlur.Enabled = true
            danserConfig.Recording.MotionBlur.OversampleMultiplier = 16
            danserConfig.Recording.MotionBlur.BlendFrames = 22
        } else {
            danserConfig.Recording.MotionBlur.Enabled = false
        }

        danserConfig.Recording.AudioCodec = "aac"
        danserConfig.Recording.AudioBitrate = "192k"

        await writeDanserConfig(danserConfig)

        console.log("Finished to write data to danser settings. Starting the render now.")

        const danserHandler = require("./danserHandler").startDanser
        var danserArguments = ["-replay", `rawReplays/${replayFilename}`, "-out", `render${data.renderID}`]
        if (data.skip) {
            danserArguments.push("-skip")
        }

        var videoName = `render${data.renderID}`
        danserHandler(danserArguments, videoName)
    }
}
