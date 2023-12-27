const { readConfig } = require("./util")

module.exports = async () => {
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
                const axios = require("axios")
                const { data: data } = await axios.get((config.customServer.apiUrl !== "" ? config.customServer.apiUrl : "https://apis.issou.best") + "/ordr/dansermd5")
                if (data.correctHashes.indexOf(hash.digest("hex")) === -1) {
                    console.log("The version of danser is too old, updating now")
                    const danserUpdater = require("./danserUpdater")
                    await danserUpdater(() => {}, data.version)
                }
                resolve(true)
            }
        })
    })
}
