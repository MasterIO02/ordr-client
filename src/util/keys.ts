import fs from "fs"
import { z } from "zod"

const keysPath = "./keys.json"

const KeysFileSchema = z.object({
    client_id: z.string(),
    osu: z.object({
        oauth_client_id: z.string(),
        oauth_client_secret: z.string()
    })
})

export type TKeysFile = z.infer<typeof KeysFileSchema>

/**
 * @description read this client's key file
 * @returns the parsed key file content if the key exists, null otherwise
 */
async function readKeysFile(): Promise<TKeysFile | null> {
    if (!fs.existsSync(keysPath)) return null

    let keysFile = fs.readFileSync(keysPath, { encoding: "utf-8" })
    try {
        let parsedKeysFile = KeysFileSchema.parse(JSON.parse(keysFile))
        return parsedKeysFile
    } catch (err) {
        console.error("The keys file has an invalid format.", err)
        process.exit(1)
    }
}

/**
 * @description write the new client's key
 * @param content the key file contents
 */
export async function writeKeysFile(content: TKeysFile): Promise<boolean> {
    try {
        fs.writeFileSync(keysPath, JSON.stringify(content), { encoding: "utf-8" })
        return true
    } catch (err) {
        console.error("Couldn't write the keys file!", err)
        process.exit(1)
    }
}

let cachedKeysFile: TKeysFile | undefined
/**
 * @returns this client's ID as specified in the key file
 */
export async function getKeys(): Promise<TKeysFile | null> {
    if (!cachedKeysFile) {
        let keysFileContent = await readKeysFile()
        if (keysFileContent) cachedKeysFile = keysFileContent
    }
    return cachedKeysFile ?? null
}
