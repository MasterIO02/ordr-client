import fs from "fs"
import crypto from "crypto"

/**
 * @description Compute the md5 checksum for a supplied file path
 * @returns the computed md5 if the file is readable, null otherwise
 */
export default async function computeMd5(path: string): Promise<string | null> {
    return new Promise(resolve => {
        try {
            const input = fs.createReadStream(path)
            const hash = crypto.createHash("md5")

            input.on("error", err => {
                console.error(`Error reading file "${path}"`, err)
                resolve(null)
            })

            input.on("readable", () => {
                const data = input.read()
                if (data) {
                    hash.update(data)
                } else {
                    resolve(hash.digest("hex"))
                }
            })
        } catch (err) {
            console.error(`Synchronous error computing md5 for "${path}"`, err)
            resolve(null)
        }
    })
}
