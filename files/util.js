const wget = require("wget-improved")
const AdmZip = require("adm-zip")
const fs = require("fs")
const readline = require("readline")

exports.exit = async () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    await new Promise(resolve => {
        rl.question("Press the enter key to exit.", () => {
            rl.close()
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
            zip.extractAllTo(output)
            fs.unlinkSync(input)
            if (filename !== "librespeed") console.log(`Finished unpacking ${type} ${filename}.`)
            resolve()
        } catch (err) {
            console.log("An error occured while unpacking the skin: " + err)
            ;async () => {
                this.exit()
            }
            reject()
        }
    })
}
