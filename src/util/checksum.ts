import fs from "fs"
import crypto from "crypto"

/**
 * @description Compute the md5 checkum for a supplied file path
 * @returns the computed md5 if the file is readable, null otherwise
 */
export default async function computeMd5(path: string): Promise<string | null> {
    try {
        return await new Promise(async (resolve, reject) => {
            const input = fs.createReadStream(path)
            const hash = crypto.createHash("md5")

            input.on("error", err => {
                console.debug(err)
                reject(err)
            })

            input.on("readable", async () => {
                const data = input.read()
                if (data) {
                    hash.update(data)
                } else {
                    resolve(hash.digest("hex"))
                }
            })
        })
    } catch (err) {
        console.debug(err)
        return null
    }
}
