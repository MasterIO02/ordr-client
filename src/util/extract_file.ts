import cleanExit from "./clean_exit"

import AdmZip from "adm-zip"
import fs from "fs"

/**
 * @description Extracts a zip file from input to output
 * @param data.input The path to the zip file to extract
 * @param data.output The path to the folder where the zip file will be extracted
 * @param data.deleteZip Delete the original zip file after it's extracted. Default to true.
 */
export default async function extractFile({ input, output, deleteZip = true }: { input: string; output: string; deleteZip?: boolean }): Promise<boolean> {
    return await new Promise(async (resolve, reject) => {
        try {
            const zip = new AdmZip(input)
            zip.extractAllTo(output, true) // overwriting to make sure we can write over renderers and the maps
            if (deleteZip) fs.unlinkSync(input)
            resolve(true)
        } catch (err) {
            console.log(`An error occured while extracting ${input}`, err)
            await cleanExit() // when failing to extract a file, we're always exiting. we don't want to try again because it generally means the storage is bad (no space left, dead sectors)
            reject(false)
        }
    })
}
