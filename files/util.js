const wget = require("wget-improved")
const AdmZip = require("adm-zip")
const fs = require("fs")

exports.exit = async () => {
    process.stdin.setRawMode(true)
    process.stdin.resume()

    console.log("Press any key to exit.")

    await new Promise(resolve => {
        process.stdin.once("data", () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            resolve()
            process.exit(0)
        })
    })
}

exports.asyncDownload = async (link, output, filename, type) => {
    await new Promise((resolve, reject) => {
        let download = wget.download(link, output)

        download.on("error", async err => {
            console.log(err)
            await this.exit()
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
            const zip = new AdmZip(input)
            zip.extractAllTo(output, true) // overwriting is required to update danser and the maps
            fs.unlinkSync(input)
            if (filename !== "librespeed") console.log(`Finished unpacking ${type} ${filename}.`)
            resolve()
        } catch (err) {
            console.log(`An error occured while unpacking ${type}`, err)
            ;async () => {
                this.exit()
            }
            reject()
        }
    })
}
