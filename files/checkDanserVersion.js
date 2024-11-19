const { getMd5 } = require("./util")

module.exports = async (filesToValidate, danserVersion) => {
    if (!(await validateFiles(filesToValidate))) {
        console.log("The version of danser is too old or corrupted, updating now")
        const danserUpdater = require("./danserUpdater")
        await danserUpdater(() => {}, danserVersion)
    }
}

async function validateFiles(filesToValidate) {
    for (let i = 0; i < filesToValidate.length; i++) {
        let file = filesToValidate[i]
        if (file.for !== "danser") continue

        let localHash, remoteHash
        if (file.windows && process.platform === "win32") {
            localHash = await getMd5(file.path)
            remoteHash = file.windows
        } else if (file.linux && process.platform === "linux") {
            localHash = await getMd5(file.path)
            remoteHash = file.linux
        } else {
            continue
        }

        if (localHash !== remoteHash) return false // the file didn't pass, we need to redownload danser
    }

    // every file passed
    return true
}
