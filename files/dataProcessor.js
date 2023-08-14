const fs = require("fs")
const wget = require("wget-improved")
const config = require(process.cwd() + "/config.json")
const settingsGenerator = require("./settingsGenerator")
const { asyncDownload, asyncExtract } = require("./util")
const { updatePresence } = require("./presence")

let songsDir
if (config.customSongsFolderPath !== "") {
    songsDir = config.customSongsFolderPath
} else {
    songsDir = process.cwd() + "/files/danser/Songs"
}

module.exports = async data => {
    const { sendProgression } = require("./server")

    async function writeDanserConfig(danserConfig) {
        fs.writeFileSync("files/danser/settings/default.json", JSON.stringify(danserConfig, null, 1), "utf-8", err => {
            if (err) throw err
        })
    }

    if (config.discordPresence) updatePresence("Working", false)

    if (data.turboMode) console.log("ENABLING TURBO MODE. PREPARE FOR FAST RENDER.")

    if ((data.skin !== "default" && config.customServer.apiUrl === "") || config.dev) {
        if (data.customSkin) {
            // custom skins are saved with CUSTOM_ at the start of the skin filename
            if (fs.existsSync(`${process.cwd()}/files/danser/Skins/CUSTOM_${data.skin}`)) {
                console.log(`Custom skin ${data.skin} is present.`)
                downloadReplay()
            } else {
                const link = `https://link.issou.best/skin/clientdownload/${data.skin}`
                const localSkinPath = `${process.cwd()}/files/danser/Skins/CUSTOM_${data.skin}.osk`

                await asyncDownload(link, localSkinPath, data.skin, "custom skin")
                await asyncExtract(localSkinPath, `${process.cwd()}/files/danser/Skins/CUSTOM_${data.skin}`, data.skin, "custom skin")
                downloadReplay()
            }
        } else {
            if (fs.existsSync(`${process.cwd()}/files/danser/Skins/${data.skin}`)) {
                console.log(`Skin ${data.skin} is present.`)
                downloadReplay()
            } else {
                let linkSuffix = config.relay === "direct" ? "" : `-${config.relay}`
                const link = `https://dl${linkSuffix}.issou.best/ordr/skins/${data.skin}.osk`
                const localSkinPath = `${process.cwd()}/files/danser/Skins/${data.skin}.osk`

                await asyncDownload(link, localSkinPath, data.skin, "skin")
                await asyncExtract(localSkinPath, `${process.cwd()}/files/danser/Skins/${data.skin}`, data.skin, "skin")
                downloadReplay()
            }
        }
    } else {
        downloadReplay()
    }

    var replayFilename
    async function downloadReplay() {
        const link = data.replayFilePath
        replayFilename = link.split("/").pop()
        const output = `${process.cwd()}/files/danser/rawReplays/${replayFilename}`
        let download = wget.download(link, output)
        download.on("error", err => {
            console.log("Cannot download the replay.", err)
            sendProgression("download_replay_404")
            if (config.discordPresence) updatePresence("Idle", false)
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
        if (fs.existsSync(`${songsDir}/${filename}`) && !data.needToRedownload) {
            console.log(`The map ${filename} is present.`)
            settingsGenerator("change", data.resolution, data.turboMode, () => {
                changeConfig()
            })
        } else {
            let foundMap = false
            const mapFolder = fs.readdirSync(songsDir)
            for (let i = 0; i < mapFolder.length; i++) {
                if (mapFolder[i].split(" ", 1)[0] === filename) {
                    console.log(`The map ${filename} is present.`)
                    foundMap = true
                    break
                }
            }
            if (data.needToRedownload) {
                console.log("A beatmap update is available.")
            } else if (foundMap) {
                settingsGenerator("change", data.resolution, data.turboMode, () => {
                    changeConfig()
                })
            }
            if ((!foundMap && !data.needToRedownload) || data.needToRedownload) {
                const output = `${songsDir}/${filename}.osz`
                let download = wget.download(link, output)
                download.on("start", fileSize => {
                    console.log(`Downloading the map at ${link}: ${fileSize} bytes to download...`)
                })
                download.on("end", () => {
                    console.log(`Finished downloading the map.`)
                    settingsGenerator("change", data.resolution, data.turboMode, () => {
                        changeConfig()
                    })
                })
                download.on("error", err => {
                    console.log("Cannot download the map.", err)
                    sendProgression("download_404")
                    if (config.discordPresence) updatePresence("Idle", false)
                })
            }
        }
    }

    async function changeConfig() {
        const danserConfig = require(process.cwd() + "/files/danser/settings/default.json")

        var resolution = data.resolution.split(" ")[0].split("x")
        let width = Number(resolution[0])
        let height = Number(resolution[1])
        danserConfig.Recording.FrameWidth = width !== 3840 ? width : 1920
        danserConfig.Recording.FrameHeight = height !== 2160 ? height : 1080

        if (data.turboMode) {
            danserConfig.Recording.FPS = 15
        } else if (data.resolution == "640x480") {
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
        danserConfig.Audio.PlayNightcoreSamples = data.playNightcoreSamples

        danserConfig.Gameplay.IgnoreFailsInReplays = data.ignoreFail ? data.ignoreFail : false

        danserConfig.Gameplay.HitErrorMeter.Show = data.showHitErrorMeter
        danserConfig.Gameplay.HitErrorMeter.ShowUnstableRate = data.showUnstableRate
        danserConfig.Gameplay.Score.Show = data.showScore
        danserConfig.Gameplay.HpBar.Show = data.showHPBar
        danserConfig.Gameplay.ComboCounter.Show = data.showComboCounter
        danserConfig.Gameplay.KeyOverlay.Show = data.showKeyOverlay
        danserConfig.Gameplay.ScoreBoard.Show = data.showScoreboard

        danserConfig.Gameplay.PPCounter.Show = data.showPPCounter
        danserConfig.Gameplay.HitCounter.Show = data.showHitCounter
        danserConfig.Gameplay.HitCounter.ShowSliderBreaks = data.showSliderBreaks ? data.showSliderBreaks : false
        danserConfig.Gameplay.AimErrorMeter.Show = data.showAimErrorMeter
        danserConfig.Gameplay.StrainGraph.Show = data.showStrainGraph ? data.showStrainGraph : false

        if (config.customServer.apiUrl === "" || config.dev) {
            danserConfig.Gameplay.PPCounter.Align = "TopLeft"
            danserConfig.Gameplay.PPCounter.XPosition = data.elementsPosition.ppCounter.x
            danserConfig.Gameplay.PPCounter.YPosition = data.elementsPosition.ppCounter.y
            danserConfig.Gameplay.HitCounter.Align = "TopLeft"
            danserConfig.Gameplay.HitCounter.ValueAlign = "TopLeft"
            danserConfig.Gameplay.HitCounter.XPosition = data.elementsPosition.hitCounter.x
            danserConfig.Gameplay.HitCounter.YPosition = data.elementsPosition.hitCounter.y
            danserConfig.Gameplay.AimErrorMeter.Align = "TopLeft"
            danserConfig.Gameplay.AimErrorMeter.XPosition = data.elementsPosition.aimErrorMeter.x
            danserConfig.Gameplay.AimErrorMeter.YPosition = data.elementsPosition.aimErrorMeter.y
            danserConfig.Gameplay.StrainGraph.Align = "TopLeft"
            danserConfig.Gameplay.StrainGraph.XPosition = data.elementsPosition.strainGraph.x
            danserConfig.Gameplay.StrainGraph.YPosition = data.elementsPosition.strainGraph.y
        } else {
            danserConfig.Gameplay.PPCounter.Align = "CentreLeft"
            danserConfig.Gameplay.PPCounter.XPosition = 5
            danserConfig.Gameplay.PPCounter.YPosition = 150
            danserConfig.Gameplay.HitCounter.Align = "Left"
            danserConfig.Gameplay.HitCounter.ValueAlign = "Left"
            danserConfig.Gameplay.HitCounter.XPosition = 5
            danserConfig.Gameplay.HitCounter.YPosition = 190
            danserConfig.Gameplay.AimErrorMeter.Align = "Right"
            danserConfig.Gameplay.AimErrorMeter.XPosition = 1350
            danserConfig.Gameplay.AimErrorMeter.YPosition = 650
            danserConfig.Gameplay.StrainGraph.Align = "BottomLeft"
            danserConfig.Gameplay.StrainGraph.XPosition = 5
            danserConfig.Gameplay.StrainGraph.YPosition = 310
        }

        if (data.showScoreboard) {
            danserConfig.Gameplay.ScoreBoard.HideOthers = false
            if (data.showAvatarsOnScoreboard) {
                danserConfig.Gameplay.ScoreBoard.ShowAvatars = true
            } else {
                danserConfig.Gameplay.ScoreBoard.ShowAvatars = false
            }
        } else {
            danserConfig.Gameplay.ScoreBoard.HideOthers = true
            danserConfig.Gameplay.ScoreBoard.ShowAvatars = false
        }

        danserConfig.Gameplay.Boundaries.Enabled = data.showBorders
        danserConfig.Gameplay.Mods.Show = data.showMods
        danserConfig.Gameplay.ShowResultsScreen = data.showResultScreen

        if (data.customSkin) {
            danserConfig.Skin.CurrentSkin = "CUSTOM_" + data.skin
        } else {
            danserConfig.Skin.CurrentSkin = data.skin
        }

        danserConfig.Skin.Cursor.UseSkinCursor = data.useSkinCursor
        danserConfig.Skin.FallbackSkin = "default_fallback"

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

        if (data.cursorTrail) {
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
            danserConfig.Skin.UseBeatmapColors = false
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

        danserConfig.Playfield.OsuShift = true

        danserConfig.Cursor.CursorRipples = data.cursorRipples
        danserConfig.Objects.Sliders.Snaking.In = data.sliderSnakingIn
        danserConfig.Objects.Sliders.Snaking.Out = data.sliderSnakingOut

        if (data.motionBlur960fps) {
            danserConfig.Recording.MotionBlur.Enabled = true
            if (config.customServer.apiUrl === "" || config.dev) {
                danserConfig.Recording.MotionBlur.OversampleMultiplier = Number(((data.motionBlurForce * 16) / 960).toFixed(0))
                danserConfig.Recording.MotionBlur.BlendFrames = Number(((data.motionBlurForce * 22) / 960).toFixed(0))
            } else {
                danserConfig.Recording.MotionBlur.OversampleMultiplier = 16
                danserConfig.Recording.MotionBlur.BlendFrames = 22
            }
        } else {
            danserConfig.Recording.MotionBlur.Enabled = false
        }

        danserConfig.Recording.AudioCodec = "aac"
        if (data.turboMode) {
            danserConfig.Recording.aac.Bitrate = "24k"
        } else {
            danserConfig.Recording.aac.Bitrate = "160k"
        }

        await writeDanserConfig(danserConfig)

        console.log("Finished to write data to danser settings. Starting the render now.")

        const danserHandler = require("./danserHandler").startDanser
        var danserArguments = ["-replay", `rawReplays/${replayFilename}`, "-out", `render${data.renderID}`, "-noupdatecheck"]
        if (data.skip) {
            danserArguments.push("-skip")
        }
        if (data.addPitch) {
            danserArguments.push("-pitch=1.5")
        }

        var videoName = `render${data.renderID}`
        danserHandler(danserArguments, videoName)
    }
}
