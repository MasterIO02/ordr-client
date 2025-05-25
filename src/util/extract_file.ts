import cleanExit from "./clean_exit"

const wget = require("wget-improved")
const AdmZip = require("adm-zip")
const fs = require("fs")

/**
 * @description Extracts a zip file from input to output
 * @param input The path to the zip file to extract
 * @param output The path to the folder where the zip file will be extracted
 */
export default async function extractFile(input: string, output: string): Promise<boolean> {
    return await new Promise(async (resolve, reject) => {
        try {
            const zip = new AdmZip(input)
            zip.extractAllTo(output, true) // overwriting to make sure we can write over renderers and the maps
            fs.unlinkSync(input)
            resolve(true)
        } catch (err) {
            console.log(`An error occured while extracting ${input}`, err)
            await cleanExit()
            reject(false)
        }
    })
}
