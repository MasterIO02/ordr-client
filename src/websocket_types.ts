import { TDanserError } from "./renderers/danser/render"

export interface WssServerToClientEvents {
    job: (data: IJobData) => void
    cool_message: (message: string, exit: boolean) => void
    invalid_version: (data: { expectedVersion: number }) => void
    abort_render: () => void
    job_idle: () => void
}

export type TJobState = "UPLOADING" | "DONE"

export type TORVError = "BEATMAP_NOT_FOUND" | "PANIC" | "KILLED_STUCK" | "KILLED_REQUESTED" | "KILLED_UNKNOWN" | "SCREENSHOT_FAILED" | "REALM_CHECK_FAILED"

export type TJobErrorEventRequest = { source: "GENERAL"; error: TJobPreparationError | TJobUploadError } | { source: "DANSER"; error: TDanserError } | { source: "DANSER_PANIC"; panic: string } | { source: "ORV"; error: TORVError } | { source: "ORV_PANIC"; panic: string }

export interface WssClientToServerEvents {
    auth: (data: {
        // prettier-ignore
        id: string
        version: number
        usingOsuApi: boolean
        encodingWith: string
        isRendering: boolean
        capabilities: { danser: { motion_blur: boolean; uhd: boolean } }
        acceptJobs: { danser_videos: boolean; orv_skin_previews: boolean }
        customization: ICustomizationSettings
    }) => void
    job_state: (data: TJobState) => void
    job_progress: (data: number) => void
    job_error: (data: TJobErrorEventRequest) => void
    customization_change: (data: ICustomizationSettings) => void
}

export type TJobPreparationError = "DOWNLOAD_SKIN" | "DOWNLOAD_REPLAY" | "DOWNLOAD_BEATMAPSET"
export type TJobUploadError = "WHAT_KEY" | "FAILED_UPLOAD"

export type TDanserRenderJobData = {
    globalVolume: number
    musicVolume: number
    hitsoundVolume: number
    useSkinHitsounds: boolean
    playNightcoreSamples: boolean
    ignoreFail: boolean
    showHitErrorMeter: boolean
    showUnstableRate: boolean
    showScore: boolean
    showHPBar: boolean
    showComboCounter: boolean
    showKeyOverlay: boolean
    showScoreboard: boolean
    showPPCounter: boolean
    showHitCounter: boolean
    showSliderBreaks: boolean
    showAimErrorMeter: boolean
    showStrainGraph: boolean
    elementsPosition: {
        aimErrorMeter: {
            x: number
            y: number
        }
        ppCounter: {
            x: number
            y: number
        }
        hitCounter: {
            x: number
            y: number
        }
        strainGraph: {
            x: number
            y: number
        }
    }
    showAvatarsOnScoreboard: boolean
    showBorders: boolean
    showMods: boolean
    showResultScreen: boolean
    useSkinCursor: boolean
    useSkinColors: boolean
    useBeatmapColors: boolean
    cursorScaleToCS: boolean
    cursorRainbow: boolean
    cursorTrailGlow: boolean
    cursorSize: number
    cursorTrail: boolean
    drawFollowPoints: boolean
    drawComboNumbers: boolean
    scaleToTheBeat: boolean
    sliderMerge: boolean
    objectsRainbow: boolean
    objectsFlashToTheBeat: boolean
    useHitCircleColor: boolean
    seizureWarning: boolean
    loadStoryboard: boolean
    loadVideo: boolean
    introBGDim: number
    inGameBGDim: number
    breakBGDim: number
    BGParallax: boolean
    showDanserLogo: boolean
    cursorRipples: boolean
    sliderSnakingIn: boolean
    sliderSnakingOut: boolean
    motionBlur960fps: boolean
    motionBlurForce: number
    skip: boolean
    addPitch: boolean
    hasOnlineOffset: boolean
}

export type TVideoRenderJobData = {
    /**
     * @description ID of the (custom) skin. 0 = default for the renderer
     */
    skin: number
    skinVersion: number
    skinMinorVersion: number
    turboMode: boolean
    renderID: number
    replayUrl: string
    mapUrl: string
    needToRedownload: boolean
    resolution: string
}

export type TSkinPreviewJobData = {
    skin: number
    skinVersion: number
    skinMinorVersion: number
    gamemodes: {
        osu?: { timestamps: { time: number, title: string }[] }
        taiko?: { timestamps: { time: number, title: string }[] }
        catch?: { timestamps: { time: number, title: string }[] }
        mania?: { timestamps: { time: number, title: string }[] }
    }
}

export type IJobData = { job: "DANSER_RENDER"; jobData: TVideoRenderJobData & TDanserRenderJobData } | { job: "SKIN_PREVIEW"; jobData: TSkinPreviewJobData }

export interface ICustomizationSettings {
    textColor: string
    backgroundType: number
}
