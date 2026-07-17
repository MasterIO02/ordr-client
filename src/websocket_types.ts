export interface WssServerToClientEvents {
    job: (data: IJobData) => void
    cool_message: (message: string, exit: boolean) => void
    invalid_version: (data: { expectedVersion: number }) => void
    abort_render: () => void
}

export interface WssClientToServerEvents {
    id: (data: { id: string; version: number; usingOsuApi: boolean; motionBlurCapable: boolean; uhdCapable: boolean; isRendering: boolean; encodingWith: string; customization: ICustomizationSettings }) => void
    progression: (data: { progress: string }) => void
    panic: (data: { crash: string }) => void
    customization_change: (data: ICustomizationSettings) => void
}

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

export interface IJobData {
    job: "DANSER_RENDER"
    jobData: TVideoRenderJobData & TDanserRenderJobData
}

export interface ICustomizationSettings {
    textColor: string
    backgroundType: number
}
