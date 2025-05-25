import fs from "fs"
import { z } from "zod"

const keyPath = "./key.json"

const KeyFileSchema = z.object({
    id: z.string()
})

export type TKeyFile = z.infer<typeof KeyFileSchema>

/**
 * @description read this client's key file
 * @returns the parsed key file content if the key exists, null otherwise
 */
export async function readKeyFile(): Promise<TKeyFile | null> {
    if (!fs.existsSync(keyPath)) return null

    let keyFile = fs.readFileSync(keyPath, { encoding: "utf-8" })
    try {
        let parsedKeyFile = KeyFileSchema.parse(JSON.parse(keyFile))
        return parsedKeyFile
    } catch (err) {
        console.error("The key file has an invalid format.", err)
        process.exit(1)
    }
}

/**
 * @description write the new client's key
 * @param content the key file contents
 */
export async function writeKeyFile(content: TKeyFile): Promise<boolean> {
    try {
        fs.writeFileSync(keyPath, JSON.stringify(content), { encoding: "utf-8" })
        return true
    } catch (err) {
        console.error("Couldn't write the key file!", err)
        process.exit(1)
    }
}

let cachedKeyFile: TKeyFile | undefined
/**
 * @returns this client's ID as specified in the key file
 */
export async function getId(): Promise<string | null> {
    if (!cachedKeyFile) {
        let keyFileContent = await readKeyFile()
        if (keyFileContent) cachedKeyFile = keyFileContent
    }
    return cachedKeyFile ? cachedKeyFile.id : null
}
