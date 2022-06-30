const fs = require("fs")
const wget = require("wget-improved")
const unzipper = require("unzipper")

exports.exit = () => {
    console.log("Press any key to exit.")
    process.stdin.setRawMode(true)
    process.stdin.on("data", process.exit.bind(process, 0))
}

exports.asyncDownload = async (link, output, filename, type) => {
    await new Promise((resolve, reject) => {
        let download = wget.download(link, output)

        download.on("error", err => {
            console.log(err)
            this.exit()
            reject()
        })
        download.on("start", fileSize => {
            console.log(`Downloading ${type} ${filename} at ${link}: ${fileSize} bytes to download...`)
        })
        download.on("end", () => {
            console.log(`Finished downloading ${type} ${filename}.`)
            resolve()
        })
    })
}

exports.asyncExtract = async (input, output, filename, type) => {
    await new Promise((resolve, reject) => {
        try {
            console.log(`Unpacking ${type} ${filename}.`)
            fs.createReadStream(input)
                .pipe(unzipper.Extract({ path: output }))
                .on("close", () => {
                    console.log(`Finished unpacking ${type} ${filename}.`)
                    fs.unlinkSync(input)
                    resolve()
                })
        } catch (err) {
            console.log("An error occured while unpacking the skin: " + err)
            this.exit()
            reject()
        }
    })
}
