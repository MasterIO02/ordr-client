const path = require("path")
const wget = require("wget-improved")
const fs = require("fs")
const unzipper = require("unzipper")
const { exit } = require("./util")

module.exports = async () => {
    var link = `https://dl.issou.best/ordr/client-latest.zip`
    const output = path.resolve("files/client-latest.zip")

    let download = wget.download(link, output)
    download.on("error", async err => {
        console.log(err)
        await exit()
    })
    download.on("start", fileSize => {
        console.log(`Downloading the client update at ${link}, ${fileSize} bytes to download...`)
    })
    download.on("end", async () => {
        try {
            fs.createReadStream(output)
                .pipe(
                    unzipper.Extract({
                        path: `.`
                    })
                )
                .on("close", async () => {
                    console.log(`Finished updating the client. You can now restart it.`)
                    await exit()
                })
        } catch (err) {
            console.log("An error occured while unpacking: " + err)
            await exit()
        }
    })
}
