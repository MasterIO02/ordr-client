const path = require("path")
const wget = require("wget-improved")
const fs = require("fs")
const unzipper = require("unzipper")

module.exports = async () => {
    var link = `https://dl.issou.best/ordr/client-latest.zip`
    const output = path.resolve("files/client-latest.zip")

    let download = wget.download(link, output)
    download.on("error", err => {
        console.log(err)
        process.exit()
    })
    download.on("start", fileSize => {
        console.log(`Downloading the client update at ${link}, ${fileSize} bytes to download...`)
    })
    download.on("end", () => {
        try {
            fs.createReadStream(output)
                .pipe(
                    unzipper.Extract({
                        path: `.`
                    })
                )
                .on("close", () => {
                    console.log(`Finished updating the client. You can now restart it.`)
                    process.exit()
                })
        } catch (err) {
            console.log("An error occured while unpacking: " + err)
            process.exit(1)
        }
    })
}
