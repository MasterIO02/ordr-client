import { createWriteStream } from "fs"
import cleanExit from "./clean_exit"
import path from "path"
import { pipeline } from "stream/promises"

/**
 * @param data.url The URL path to download the file
 * @param data.to The path where the file should be downloaded
 * @param data.filename An optional custom filename to give to the file
 * @param data.exitOnFail Should this function exit the client if a fail occurs? default to true
 * @description Download a file from a given URL
 * @returns True if success, false if fail
 */
export default async function downloadFile({ url, to, filename, exitOnFail = true }: { url: string; to: string; filename?: string; exitOnFail?: boolean }): Promise<boolean> {
    try {
        let response = await fetch(url)

        if (!response.ok) {
            console.error(`Encountered status code ${response.status} while trying to download ${url}`)
            if (exitOnFail) await cleanExit()
            return false
        }

        const contentLength = response.headers.get("content-length")
        let filesize: string = contentLength ? (Number(contentLength) / (1024 * 1024)).toFixed(2) : "unknown"
        let outputFilename = filename ? filename : path.basename(new URL(url).pathname)

        console.log(`Downloading ${outputFilename} (${filesize} MB) at ${url}...`)
        let webStream = createWriteStream(`${to}/${outputFilename}`)
        if (!response.body) {
            console.error(`The file to download at ${url} has no body`)
            if (exitOnFail) await cleanExit()
            return false
        }

        await pipeline(response.body, webStream)

        return true
    } catch (err) {
        console.error(`An error occured while trying to download ${url}`, err)
        if (exitOnFail) await cleanExit()
        return false
    }
}
