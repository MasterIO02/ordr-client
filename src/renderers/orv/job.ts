import fs from "fs"
import { emitJobError, emitJobProgress, emitJobState } from "../../websocket"
import { SKIN_PREVIEW_GAMEMODES, TJobPreparationError, TSkinPreviewJobData } from "../../websocket_types"
import { buildSkinFolderName } from "../common"
import { importSkin, takeScreenshot, verifyRealmBeatmap, verifyRealmSkin, abortORVRender } from "./render"
import { previewMapMd5s } from "./prepare"
import uploadSkinPreviews from "./upload"
import downloadFile from "../../util/download_file"
import { config } from "../../util/config"

const SCREENSHOT_GLOBAL_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes for all screenshots combined

/**
 * @description Download a custom skin .osk for ORV import
 */
async function downloadSkin(skinId: number, skinVersion: number, skinMinorVersion: number): Promise<{ success: true; oskPath: string } | { success: false; error: TJobPreparationError }> {
    const skinFolder = buildSkinFolderName(skinId, skinVersion, skinMinorVersion)
    const oskPath = `data/skins/${skinFolder}.osk`

    const url = config.dev ? `${config.dev.server.shortlink}/skin/download/${skinId}/renderer` : `https://link.issou.best/skin/download/${skinId}/renderer`

    let downloadedSkin = await downloadFile({ url, to: "data/skins", filename: `${skinFolder}.osk`, exitOnFail: false })
    if (!downloadedSkin) return { success: false, error: "DOWNLOAD_SKIN" }

    console.log(`Successfully downloaded .osk for skin #${skinId}`)

    return { success: true, oskPath }
}

/**
 * @description Orchestrate a skin preview job: import the skin into ORV, take screenshots for each requested gamemode/timestamp, and upload all PNGs
 */
export async function triggerSkinPreviewJob(jobData: TSkinPreviewJobData): Promise<{ success: boolean }> {
    let skinFolder = buildSkinFolderName(jobData.skin, jobData.skinVersion, jobData.skinMinorVersion)

    // handle skin: check if already in ORV Realm, otherwise download .osk and import
    let skinGuid = await verifyRealmSkin(skinFolder)

    if (skinGuid) {
        console.log(`Skin "${skinFolder}" already in ORV Realm, no import needed.`)
    } else {
        // download the .osk and import it
        let oskResult = await downloadSkin(jobData.skin, jobData.skinVersion, jobData.skinMinorVersion)
        if (!oskResult.success) {
            emitJobError({ source: "GENERAL", error: "DOWNLOAD_SKIN" })
            console.log("Waiting for a new job.")
            return { success: false }
        }

        let importResult = await importSkin(oskResult.oskPath)
        if (!importResult.success) {
            emitJobError({ source: "ORV", error: "REALM_CHECK_FAILED" })
            console.log("Waiting for a new job.")
            return { success: false }
        }

        // re-fetch the GUID now that the skin is imported
        skinGuid = await verifyRealmSkin(skinFolder)
        if (!skinGuid) {
            console.error(`Skin "${skinFolder}" not found in Realm after import. This should not happen.`)
            emitJobError({ source: "ORV", error: "REALM_CHECK_FAILED" })
            return { success: false }
        }
    }

    // take screenshots for each required gamemode with a global timeout
    let screenshotPaths: string[] = []
    let completedScreenshots = 0
    let timedOut = false

    fs.mkdirSync(`data/screenshots/${jobData.skin}`, { recursive: true })

    let globalTimeout = setTimeout(() => {
        timedOut = true
        console.error(`Screenshot rendering exceeded ${SCREENSHOT_GLOBAL_TIMEOUT_MS / 1000}s global timeout, aborting.`)
        abortORVRender("STUCK")
    }, SCREENSHOT_GLOBAL_TIMEOUT_MS)

    for (const gamemode of SKIN_PREVIEW_GAMEMODES) {
        if (timedOut) break

        const gamemodeData = jobData.gamemodes[gamemode]
        if (!gamemodeData) continue

        const mapMd5 = previewMapMd5s[gamemode]

        if (!mapMd5) {
            console.error(`Preview map MD5 for ${gamemode} not available. Was ORV startup completed?`)
            emitJobError({ source: "ORV", error: "REALM_CHECK_FAILED" })
            clearTimeout(globalTimeout)
            cleanup(jobData.skin)
            return { success: false }
        }

        // verify the preview map exists in ORV's Realm
        const mapExists = await verifyRealmBeatmap(mapMd5)
        if (!mapExists) {
            console.error(`Preview map for ${gamemode} not found in ORV Realm. This should not happen.`)
            emitJobError({ source: "ORV", error: "REALM_CHECK_FAILED" })
            clearTimeout(globalTimeout)
            cleanup(jobData.skin)
            return { success: false }
        }

        // take a screenshot at each timestamp of the gamemode
        for (let i = 0; i < gamemodeData.timestamps.length; i++) {
            if (timedOut) break

            const timestamp = gamemodeData.timestamps[i]

            let outputPath = `${process.cwd()}/data/screenshots/${jobData.skin}/${gamemode}_${timestamp.title}.png`

            let screenshotResult = await takeScreenshot(mapMd5, timestamp, outputPath, skinGuid, gamemode, jobData.skin)
            if (!screenshotResult.success) {
                if (timedOut) break

                if (screenshotResult.panic) {
                    emitJobError({ source: "ORV_PANIC", panic: screenshotResult.panic })
                } else {
                    emitJobError({ source: "ORV", error: screenshotResult.error })
                }
                clearTimeout(globalTimeout)
                cleanup(jobData.skin)
                return { success: false }
            }

            screenshotPaths.push(outputPath)
            completedScreenshots++
            emitJobProgress(completedScreenshots)
        }
    }

    clearTimeout(globalTimeout)

    if (timedOut) {
        emitJobError({ source: "ORV", error: "KILLED_STUCK" })
        cleanup(jobData.skin)
        return { success: false }
    }

    // upload all screenshots
    console.log(`Uploading ${screenshotPaths.length} skin preview screenshots.`)

    emitJobState("UPLOADING")

    let uploadResult = await uploadSkinPreviews(screenshotPaths)
    if (!uploadResult.success) {
        emitJobError({ source: "GENERAL", error: uploadResult.error })
        cleanup(jobData.skin)
        return { success: false }
    }

    emitJobState("DONE")

    cleanup(jobData.skin)
    console.log("Skin previews rendered and uploaded successfully! Waiting for a new job.")
    return { success: true }
}

/**
 * @description delete taken screenshots from fs
 */
function cleanup(skin: number) {
    let screenshotsDir = `data/screenshots/${skin}`
    if (fs.existsSync(screenshotsDir)) {
        fs.rmSync(screenshotsDir, { recursive: true, force: true })
    }
}
