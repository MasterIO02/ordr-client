const { readConfig } = require("./util")

module.exports = async (danserHashes, danserVersion) => {
    return await new Promise(async (resolve, _) => {
        let config = await readConfig()

        let filename
        if (process.platform === "win32") {
            filename = "files/danser/danser.exe"
        } else {
            filename = "files/danser/danser"
        }
        const crypto = require("crypto")
        const fs = require("fs")
        const hash = crypto.createHash("md5")
        const input = fs.createReadStream(filename)
        input.on("readable", async () => {
            const data = input.read()
            if (data) hash.update(data)
            else {
                if (danserHashes.indexOf(hash.digest("hex")) === -1) {
                    console.log("The version of danser is too old, updating now")
                    const danserUpdater = require("./danserUpdater")
                    await danserUpdater(() => {}, danserVersion)
                }
                resolve(true)
            }
        })
    })
}
