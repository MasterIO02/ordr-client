const path = require("path")
const { exit, asyncDownload, asyncExtract } = require("./util")

module.exports = async () => {
    if (process.pkg) {
        console.log("The pre-compiled version does not support auto-update. Get the latest client at https://github.com/MasterIO02/ordr-client/releases")
        await exit()
    }
    let link = `https://dl.issou.best/ordr/client-latest.zip`
    const outputZip = path.resolve("files/client-latest.zip")

    await asyncDownload(link, outputZip, "client-latest", "file")
    await asyncExtract(outputZip, ".", "client-latest", "file")

    console.log("Finished updating the client. You can now restart it.")
    await exit()
}
