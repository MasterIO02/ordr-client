import { TStartupData } from "../../util/startup_data"
import validateFiles from "../../util/validate_files"
import updateDanser from "./update"
import fs from "fs"
import { spawn } from "child_process"
import { config } from "../../util/config"
import { IJobData } from "../../websocket_types"
import { getKeys } from "../../util/keys"
import cleanExit from "../../util/clean_exit"
import si from "systeminformation"

/**
 * @description Prepare danser to be used with the client (check version, download binaries...), ran once on client startup
 */
export async function prepareDanserStartup(startupData: TStartupData) {
    if (!fs.existsSync("bins/danser")) fs.mkdirSync("bins/danser")

    let validatedFiles = await validateFiles(startupData.validateFiles, "danser")

    if (!validatedFiles) {
        console.log("The version of danser is too old or corrupted, updating now")
        await updateDanser(startupData.danserVersion)
    }

    // run danser dry once to make sure it can open
    await danserDryRun()
}

/**
 * @description Prepare danser render settings for an incoming render
 * @param jobData If supplied, the settings we have to set for the render. Else, danser's settings will be default, with the client's paths and selected encoder
 */
export async function prepareDanserRender(jobData?: IJobData) {
    // not try/catching anything here as all errors should make the client exit, everything will be catched by the global process exceptions listener

    // delete the current danser config
    if (fs.existsSync("bins/danser/settings/default.json")) {
        fs.rmSync("bins/danser/settings/default.json")
    }

    // run danser once to generate a new empty config
    await danserDryRun()

    let danserConfig = JSON.parse(fs.readFileSync("bins/danser/settings/default.json", { encoding: "utf-8" }))
    danserConfig.General.OsuSongsDir = process.cwd() + "/data/songs"
    danserConfig.General.OsuSkinsDir = process.cwd() + "/data/skins"
    danserConfig.Recording.OutputDir = process.cwd() + "/data/videos"

    switch (config.encoder) {
        case "cpu":
            danserConfig.Recording.Encoder = "libx264"
            if (jobData?.turboMode) {
                danserConfig.Recording.libx264.CRF = 51
                danserConfig.Recording.libx264.Preset = "ultrafast"
                danserConfig.Recording.libx264.AdditionalOptions = "-g 450"
            } else {
                danserConfig.Recording.libx264.CRF = 21
                danserConfig.Recording.libx264.Preset = "faster"
                danserConfig.Recording.libx264.AdditionalOptions = "-g 450"
            }
            break
        case "nvenc":
            danserConfig.Recording.Encoder = "h264_nvenc"
            if (jobData?.turboMode) {
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
        case "qsv":
            danserConfig.Recording.Encoder = "h264_qsv"
            if (jobData?.turboMode) {
                danserConfig.Recording.h264_qsv.ICQ = 51
                danserConfig.Recording.h264_qsv.Preset = "veryfast"
                danserConfig.Recording.h264_qsv.AdditionalOptions = "-g 450"
            } else {
                // -global_quality was 31 before and looked okay-ish on 1080p but very bad on 720p
                if (jobData?.resolution === "1920x1080" || jobData?.resolution === "3840x2160") {
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

    if (jobData) {
        // write danser's credentials file with the osu! oauth api keys
        let keys = await getKeys()
        if (!keys) {
            // should never happen
            console.error("No keys?!")
            await cleanExit()
            return
        }
        if (keys.osu.oauth_client_id && keys.osu.oauth_client_secret) {
            const danserCredentials = JSON.parse(fs.readFileSync("bins/danser/settings/credentials.json", { encoding: "utf-8" }))
            if (danserCredentials.ClientId !== keys.osu.oauth_client_id || danserCredentials.ClientSecret !== keys.osu.oauth_client_secret) {
                danserCredentials.ClientId = keys.osu.oauth_client_id
                danserCredentials.ClientSecret = keys.osu.oauth_client_secret
                fs.writeFileSync("bins/danser/settings/credentials.json", JSON.stringify(danserCredentials, null, 1), { encoding: "utf-8" })
            }
        }

        if (jobData.resolution === "3840x2160") {
            danserConfig.Recording.Filters = "scale=3840:2160:flags=lanczos"
        } else {
            danserConfig.Recording.Filters = ""
        }

        let resolution = jobData.resolution.split(" ")[0].split("x")
        let width = Number(resolution[0])
        let height = Number(resolution[1])
        danserConfig.Recording.FrameWidth = width !== 3840 ? width : 1920
        danserConfig.Recording.FrameHeight = height !== 2160 ? height : 1080

        if (jobData.turboMode) {
            danserConfig.Recording.FPS = 15
        } else if (jobData.resolution == "640x480") {
            danserConfig.Recording.FPS = 30
        } else {
            danserConfig.Recording.FPS = 60
        }

        danserConfig.Audio.GeneralVolume = jobData.globalVolume === 100 ? 1 : Number("0." + jobData.globalVolume)
        danserConfig.Audio.MusicVolume = jobData.musicVolume === 100 ? 1 : Number("0." + jobData.musicVolume)
        danserConfig.Audio.SampleVolume = jobData.hitsoundVolume === 100 ? 1 : Number("0." + jobData.hitsoundVolume)

        danserConfig.Audio.IgnoreBeatmapSamples = jobData.useSkinHitsounds
        danserConfig.Audio.PlayNightcoreSamples = jobData.playNightcoreSamples

        danserConfig.Audio.OnlineOffset = jobData.hasOnlineOffset

        danserConfig.Gameplay.IgnoreFailsInReplays = jobData.ignoreFail ?? false

        danserConfig.Gameplay.HitErrorMeter.Show = jobData.showHitErrorMeter
        danserConfig.Gameplay.HitErrorMeter.ShowUnstableRate = jobData.showUnstableRate
        danserConfig.Gameplay.Score.Show = jobData.showScore
        danserConfig.Gameplay.HpBar.Show = jobData.showHPBar
        danserConfig.Gameplay.ComboCounter.Show = jobData.showComboCounter
        danserConfig.Gameplay.KeyOverlay.Show = jobData.showKeyOverlay
        danserConfig.Gameplay.ScoreBoard.Show = jobData.showScoreboard

        danserConfig.Gameplay.PPCounter.Show = jobData.showPPCounter
        danserConfig.Gameplay.HitCounter.Show = jobData.showHitCounter
        danserConfig.Gameplay.HitCounter.ShowSliderBreaks = jobData.showSliderBreaks ?? false
        danserConfig.Gameplay.AimErrorMeter.Show = jobData.showAimErrorMeter
        danserConfig.Gameplay.StrainGraph.Show = jobData.showStrainGraph ?? false

        danserConfig.Gameplay.PPCounter.Align = "TopLeft"
        danserConfig.Gameplay.PPCounter.XPosition = jobData.elementsPosition.ppCounter.x
        danserConfig.Gameplay.PPCounter.YPosition = jobData.elementsPosition.ppCounter.y
        danserConfig.Gameplay.HitCounter.Align = "TopLeft"
        danserConfig.Gameplay.HitCounter.ValueAlign = "TopLeft"
        danserConfig.Gameplay.HitCounter.XPosition = jobData.elementsPosition.hitCounter.x
        danserConfig.Gameplay.HitCounter.YPosition = jobData.elementsPosition.hitCounter.y
        danserConfig.Gameplay.AimErrorMeter.Align = "TopLeft"
        danserConfig.Gameplay.AimErrorMeter.XPosition = jobData.elementsPosition.aimErrorMeter.x
        danserConfig.Gameplay.AimErrorMeter.YPosition = jobData.elementsPosition.aimErrorMeter.y
        danserConfig.Gameplay.StrainGraph.Align = "TopLeft"
        danserConfig.Gameplay.StrainGraph.XPosition = jobData.elementsPosition.strainGraph.x
        danserConfig.Gameplay.StrainGraph.YPosition = jobData.elementsPosition.strainGraph.y

        if (jobData.showScoreboard) {
            danserConfig.Gameplay.ScoreBoard.HideOthers = false
            danserConfig.Gameplay.ScoreBoard.ShowAvatars = jobData.showAvatarsOnScoreboard
        } else {
            danserConfig.Gameplay.ScoreBoard.HideOthers = true
            danserConfig.Gameplay.ScoreBoard.ShowAvatars = false
        }

        danserConfig.Gameplay.Boundaries.Enabled = jobData.showBorders
        danserConfig.Gameplay.Mods.Show = jobData.showMods
        danserConfig.Gameplay.ShowResultsScreen = jobData.showResultScreen

        danserConfig.Skin.CurrentSkin = jobData.customSkin ? `CUSTOM_${jobData.skin}` : jobData.skin

        danserConfig.Skin.Cursor.UseSkinCursor = jobData.useSkinCursor
        danserConfig.Skin.FallbackSkin = "default_fallback"

        if (jobData.useSkinColors) {
            danserConfig.Skin.UseBeatmapColors = false
            danserConfig.Skin.UseColorsFromSkin = true
        }

        if (jobData.useBeatmapColors) {
            danserConfig.Skin.UseBeatmapColors = true
            danserConfig.Skin.UseColorsFromSkin = true
        }

        danserConfig.Cursor.ScaleToCS = jobData.cursorScaleToCS
        danserConfig.Cursor.Colors.EnableRainbow = jobData.cursorRainbow
        danserConfig.Cursor.EnableTrailGlow = jobData.cursorTrailGlow
        danserConfig.Skin.Cursor.Scale = jobData.cursorSize

        if (jobData.cursorTrail) {
            danserConfig.Skin.Cursor.ForceLongTrail = false
            danserConfig.Skin.Cursor.LongTrailDensity = 1
            danserConfig.Skin.Cursor.LongTrailLength = 2048
        } else {
            danserConfig.Skin.Cursor.ForceLongTrail = true
            danserConfig.Skin.Cursor.LongTrailDensity = 0
            danserConfig.Skin.Cursor.LongTrailLength = 0
        }

        danserConfig.Objects.DrawFollowPoints = jobData.drawFollowPoints
        danserConfig.Objects.DrawComboNumbers = jobData.drawComboNumbers

        danserConfig.Objects.ScaleToTheBeat = jobData.scaleToTheBeat
        danserConfig.Objects.Sliders.SliderMerge = jobData.sliderMerge

        if (jobData.objectsRainbow) {
            danserConfig.Skin.UseBeatmapColors = false
            danserConfig.Skin.UseColorsFromSkin = false
            danserConfig.Objects.Colors.Color.EnableRainbow = true
        }

        danserConfig.Objects.Colors.Sliders.Border.Color.FlashToTheBeat = jobData.objectsFlashToTheBeat
        danserConfig.Objects.Colors.Sliders.Body.Color.FlashToTheBeat = jobData.objectsFlashToTheBeat
        danserConfig.Playfield.Background.FlashToTheBeat = jobData.objectsFlashToTheBeat

        danserConfig.Objects.Colors.Sliders.Body.UseHitCircleColor = jobData.useHitCircleColor

        danserConfig.Playfield.SeizureWarning.Enabled = jobData.seizureWarning
        danserConfig.Playfield.Background.LoadStoryboards = jobData.loadStoryboard
        danserConfig.Playfield.Background.LoadVideos = jobData.loadVideo

        danserConfig.Playfield.Background.Dim.Intro = jobData.introBGDim === 100 ? 1 : Number("0." + jobData.introBGDim)
        danserConfig.Playfield.Background.Dim.Normal = jobData.inGameBGDim === 100 ? 1 : Number("0." + jobData.inGameBGDim)
        danserConfig.Playfield.Background.Dim.Breaks = jobData.breakBGDim === 100 ? 1 : Number("0." + jobData.breakBGDim)

        danserConfig.Playfield.Background.Parallax.Amount = jobData.BGParallax ? 0.1 : 0

        danserConfig.Playfield.Logo.Dim.Intro = jobData.showDanserLogo ? 0 : 1

        danserConfig.Playfield.OsuShift = true

        danserConfig.Cursor.CursorRipples = jobData.cursorRipples
        danserConfig.Objects.Sliders.Snaking.In = jobData.sliderSnakingIn
        danserConfig.Objects.Sliders.Snaking.Out = jobData.sliderSnakingOut

        if (jobData.motionBlur960fps) {
            danserConfig.Recording.MotionBlur.Enabled = true
            danserConfig.Recording.MotionBlur.OversampleMultiplier = Number(((jobData.motionBlurForce * 16) / 960).toFixed(0))
            danserConfig.Recording.MotionBlur.BlendFrames = Number(((jobData.motionBlurForce * 22) / 960).toFixed(0))
        } else {
            danserConfig.Recording.MotionBlur.Enabled = false
        }

        danserConfig.Recording.AudioCodec = "aac"
        danserConfig.Recording.aac.Bitrate = jobData.turboMode ? "24k" : "160k"
    } else {
        danserConfig.Gameplay.ScoreBoard.Show = false // no need for scoreboard in benchmark or default settings
    }

    // write config
    fs.writeFileSync("bins/danser/settings/default.json", JSON.stringify(danserConfig, null, 1), { encoding: "utf-8" })
}

/**
 * @description Run danser "dry" to test for errors on startup, and generate empty config files (settings, credentials) when they're not present
 */
async function danserDryRun() {
    await new Promise(async resolve => {
        let gpuData = await si.graphics()
        if (gpuData.displays.length == 0) {
            console.err("It appears that you do not have a display connected. This is a requirement to run the o!rdr client. Please connect a display and try again.")
            await cleanExit()
            return
        }
        // the empty settings argument is used to not trigger the rickroll
        let danserProcess = spawn("./danser-cli", ["-settings=", "-noupdatecheck"], { cwd: "bins/danser" })
        danserProcess.addListener("exit", () => {
            resolve(true)
        })
        // should we handle anything else here? can danser panic when ran empty?
        danserProcess.on("error", err => {
            console.error("An error occured while trying to test run danser", err)
            process.exit(1)
        })
    })
}
