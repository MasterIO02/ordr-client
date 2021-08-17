const { startServer } = require("./server")

module.exports = async () => {
    var filename
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
            const correctmd5 = await axios.get("https://ordr-api.issou.best/dansermd5")
            if (correctmd5.data.correctHashes.indexOf(hash.digest("hex")) === -1) {
                console.log("The version of danser is too old, updating now")
                const danserUpdater = require("./danserUpdater")
                await danserUpdater()
            } else {
                startServer()
            }
        }
    })
}
