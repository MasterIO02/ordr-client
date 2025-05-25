import { createWriteStream } from "fs"
import cleanExit from "./clean_exit"
import path from "path"
import { pipeline } from "stream/promises"

/**
 * @param url the URL path to download the file
 * @param to the path where the file should be downloaded
 * @param filename an optional custom filename to give to the file
 * @description Download a file from a given URL
 */
export default async function downloadFile(url: string, to: string, filename?: string): Promise<boolean> {
    try {
        let response = await fetch(url)

        if (!response.ok) {
            console.error(`Encountered status code ${response.status} while trying to download ${url}`)
            await cleanExit()
            return false
        }

        const contentLength = response.headers.get("content-length")
        let filesize: string = contentLength ? (Number(contentLength) / (1024 * 1024)).toFixed(2) : "unknown"
        let outputFilename = filename ? filename : path.basename(new URL(url).pathname)

        console.log(`Downloading ${outputFilename} (${filesize} MB) at ${url}...`)
        let webStream = createWriteStream(`${to}/${outputFilename}`)
        if (!response.body) {
            console.error(`The file to download at ${url} has no body`)
            await cleanExit()
            return false
        }

        await pipeline(response.body, webStream)

        return true
    } catch (err) {
        console.error(`An error occured while trying to download ${url}`, err)
        await cleanExit()
        return false
    }
}
