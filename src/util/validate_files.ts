import computeMd5 from "./checksum"
import { TFileToValidate, TRenderer } from "./startup_data"

export default async function validateFiles(files: TFileToValidate[], renderer: TRenderer) {
    for (let i = 0; i < files.length; i++) {
        let file = files[i]

        if (file.for !== renderer) continue

        // TODO: the server should not send "files/danser/" in path when v27 becomes mandatory AND we need the server to return danser-cli filenames instead of danser!
        let filePath: string
        if (file.path === "files/danser/danser.exe") {
            filePath = "danser-cli.exe"
        } else if (file.path === "files/danser/danser") {
            filePath = "danser-cli"
        } else {
            filePath = file.path.replace("files/danser/", "")
        }

        filePath = `bins/${renderer}/${filePath}`

        console.debug(`Checking file ${filePath} for renderer ${renderer}`)

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
