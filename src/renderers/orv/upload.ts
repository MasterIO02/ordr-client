import { config } from "../../util/config"
import { getKeys } from "../../util/keys"
import fs, { openAsBlob } from "fs"
import path from "path"

/**
 * @description Upload all skin preview screenshot PNGs to the server
 * @param screenshotPaths absolute paths of the PNG files to upload
 */
export default async function uploadSkinPreviews(screenshotPaths: string[]): Promise<{ success: true } | { success: false; error: "WHAT_KEY" | "FAILED_UPLOAD" }> {
    let uploadUrl
    if (config.dev) {
        uploadUrl = config.dev.server.api + "/upload/skin-previews"
    } else {
        uploadUrl = "https://apis.issou.best/ordr/upload/skin-previews"
    }

    let keys = await getKeys()
    if (!keys) return { success: false, error: "WHAT_KEY" }

    // verify all screenshots exist before attempting upload
    for (const filePath of screenshotPaths) {
        if (!fs.existsSync(filePath)) {
            console.error(`Screenshot file missing: ${filePath}`)
            return { success: false, error: "FAILED_UPLOAD" }
        }
    }

    const formData = new FormData()
    formData.append("rendererId", keys.client_id)

    for (const filePath of screenshotPaths) {
        const blob = await openAsBlob(filePath, { type: "image/png" })
        formData.append("screenshots", blob, path.basename(filePath))
    }

    try {
        let response = await fetch(uploadUrl, {
            method: "POST",
            body: formData
        })

        if (!response.ok) {
            console.error(`Encountered status code ${response.status} while trying to upload skin previews`)
            return { success: false, error: "FAILED_UPLOAD" }
        }
    } catch (err) {
        console.error("An error occurred while trying to upload skin previews", err)
        return { success: false, error: "FAILED_UPLOAD" }
    }

    return { success: true }
}
