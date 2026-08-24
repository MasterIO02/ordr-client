import fs from "fs"
import downloadFile from "../../util/download_file"
import extractFile from "../../util/extract_file"

const ORV_DOWNLOAD_BASE = "https://dl.issou.best/ordr/client/orv"

/**
 * @description Download and extract the ORV binary for the current platform, replacing the existing installation
 */
export default async function updateORV(version: string) {
    let url: string, filename: string
    if (process.platform === "win32") {
        url = `${ORV_DOWNLOAD_BASE}/orv-${version}-win.zip`
        filename = `orv-${version}-win.zip`
    } else {
        url = `${ORV_DOWNLOAD_BASE}/orv-${version}-linux.zip`
        filename = `orv-${version}-linux.zip`
    }

    let output = "bins/orv"

    await downloadFile({ url, to: output, filename })
    console.log("Extracting osu-replay-viewer...")
    await extractFile({ input: `${output}/${filename}`, output })

    console.log("Preparing osu-replay-viewer...")
    if (process.platform === "linux") fs.chmodSync("bins/orv/osu-replay-viewer", "755")
}
