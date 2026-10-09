import fs from "fs"
import { z } from "zod"
import { isEphemeral, parseEphemeralEnv } from "./ephemeral"

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
        fs.writeFileSync(keysPath, JSON.stringify(content, null, 2), { encoding: "utf-8" })
        return true
    } catch (err) {
        console.error("Couldn't write the keys file!", err)
        process.exit(1)
    }
}

let cachedKeysFile: TKeysFile | undefined

/**
 * @description the ephemeral client ID assigned by the o!rdr server on auth, undefined until the server acknowledges us
 */
let ephemeralClientId: string | undefined

/**
 * @description store the ephemeral client ID assigned by the o!rdr server, called from the websocket auth ack handler.
 * Used on reconnect if we ever get disconnected from the server, instead of reauthing using the master key
 */
export function setEphemeralClientId(id: string) {
    ephemeralClientId = id
}

/**
 * @returns the ephemeral client ID assigned by the o!rdr server, undefined until the server acknowledged us on auth
 */
export function getEphemeralClientId(): string | undefined {
    return ephemeralClientId
}

/**
 * @returns this client's ID as specified in the key file, or the ID assigned by the server in ephemeral mode
 */
export async function getKeys(): Promise<TKeysFile | null> {
    if (isEphemeral) {
        // uploads only ever happen after the server assigned us an ID on auth
        if (!ephemeralClientId) return null
        return { client_id: ephemeralClientId, osu: parseEphemeralEnv().osuApi }
    }

    if (!cachedKeysFile) {
        let keysFileContent = await readKeysFile()
        if (keysFileContent) cachedKeysFile = keysFileContent
    }
    return cachedKeysFile ?? null
}
