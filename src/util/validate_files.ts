import computeMd5 from "./checksum"
import { TFileToValidate, TRenderer } from "./startup_data"
import { config } from "./config"

export default async function validateFiles(files: TFileToValidate[], renderer: TRenderer) {
    // make sure the files list contains at least one file for our renderer and platform
    const hasRelevantFile = files.some(file => file.for === renderer && ((file.windows && process.platform === "win32") || (file.linux && process.platform === "linux")))

    if (!hasRelevantFile) {
        if (config.debug) console.debug(`No files to validate for renderer ${renderer} on ${process.platform}`)
        return false
    }

    for (let i = 0; i < files.length; i++) {
        let file = files[i]

        if (file.for !== renderer) continue

        const filePath = `bins/${renderer}/${file.path}`

        if (config.debug) console.debug(`Checking file ${filePath} for renderer ${renderer}`)

        let localHash, remoteHash
        if (file.windows && process.platform === "win32") {
            localHash = await computeMd5(filePath)
            remoteHash = file.windows
        } else if (file.linux && process.platform === "linux") {
            localHash = await computeMd5(filePath)
            remoteHash = file.linux
        } else {
            continue
        }

        if (localHash !== remoteHash) return false // the file didn't pass, we need to redownload danser
    }

    // every file passed
    return true
}
