import inquirer from "inquirer"
import cleanExit from "./clean_exit"
import { writeConfig, config } from "./config"
import downloadFile from "./download_file"
import extractFile from "./extract_file"
import { spawn } from "child_process"
import fs from "fs"
import { z } from "zod"

const SpeedtestResultFileSchema = z.object({
    dl: z.string(),
    ul: z.string(),
    server: z.string(),
    resultUrl: z.string(),
    date: z.coerce.date()
})

export interface ISpeedtestResult {
    dl: string
    ul: string
    server: string
    resultUrl: string
}

export async function runSpeedtest(): Promise<ISpeedtestResult> {
    // check if we have a cached speedtest result that's recent enough
    if (fs.existsSync("bins/librespeed-cli/cache.json")) {
        let rawCachedResult = fs.readFileSync("bins/librespeed-cli/cache.json", { encoding: "utf-8" })
        try {
            let parsedResult = SpeedtestResultFileSchema.parse(JSON.parse(rawCachedResult))
            const ONE_DAY_MS = 24 * 60 * 60 * 1000

            // cached result is recent enough (less than a day old) so we can return it
            if (new Date().getTime() - parsedResult.date.getTime() < ONE_DAY_MS) {
                return parsedResult
            }
        } catch (err) {
            console.error("Invalid cached speedtest result file. Continuing.", err)
        }
    }

    console.log("Before running a benchmark of your computer, we need to perform a speedtest to the o!rdr server.")
    console.log("The result of this speedtest will be sent to the o!rdr server along with your benchmark results.\n")
    let { confirmed } = await inquirer.prompt({
        name: "confirmed",
        type: "confirm",
        message: "Continue?",
        default: true
    })
    if (!confirmed) await cleanExit()

    let downloadUrl: string
    let binaryName: string
    const platform = process.platform
    if (platform === "win32") {
        downloadUrl = "http://dl.issou.best/ordr/librespeed-cli-win.zip"
        binaryName = "librespeed-cli.exe"
    } else {
        // can only be linux, we exited the client before if platform isn't win32 or linux
        downloadUrl = "http://dl.issou.best/ordr/librespeed-cli-linux.zip"
        binaryName = "librespeed-cli"
    }

    // download librespeed-cli if it's not in the bins folder
    if (!fs.existsSync("bins/librespeed-cli") || !fs.existsSync(`bins/librespeed-cli/${binaryName}`)) {
        fs.mkdirSync("bins/librespeed-cli")
        await downloadFile({ url: downloadUrl, to: "bins/librespeed-cli", filename: "librespeed-cli.zip" })
        await extractFile({ input: "bins/librespeed-cli/librespeed-cli.zip", output: "bins/librespeed-cli" })

        if (process.platform === "linux") fs.chmodSync("bins/librespeed-cli/librespeed-cli", "755")
    }

    console.log("Running speedtest...")

    // write speedtest servers info for librespeed-cli to use
    fs.writeFileSync(
        "bins/librespeed-cli/config.json",
        JSON.stringify([
            {
                id: 1,
                name: "Central",
                server: "http://st1.issou.best/",
                dlURL: "garbage.php",
                ulURL: "empty.php",
                pingURL: "empty.php",
                getIpURL: "getIP.php"
            },
            {
                id: 2,
                name: "US Server",
                server: "http://st2.issou.best/",
                dlURL: "garbage.php",
                ulURL: "empty.php",
                pingURL: "empty.php",
                getIpURL: "getIP.php"
            }
        ]),
        { encoding: "utf-8" }
    )

    return await new Promise(resolve => {
        let result: ISpeedtestResult

        const speedtestProcess = spawn(`./${binaryName}`, ["--share", "--telemetry-level", "full", "--telemetry-server", "http://speedtest.issou.best", "--telemetry-path", "/results/telemetry.php", "--telemetry-share", "/results/", "--duration", "10", "--json", "--local-json", `./config.json`], { cwd: "bins/librespeed-cli" })
        speedtestProcess.stdout.setEncoding("utf8")
        speedtestProcess.stdout.on("data", async data => {
            const parsedData = JSON.parse(data)
            result = { dl: parsedData[0].download.toString(), ul: parsedData[0].upload.toString(), server: parsedData[0].server.name, resultUrl: parsedData[0].share }
            console.log(`Download: ${result.dl} Mbps`)
            console.log(`Upload: ${result.ul} Mbps`)
            console.log(`Server: ${result.server}`)
            console.log(`Result link: ${result.resultUrl}`)

            const serverUsed = parsedData[0].server.name
            // if the server we used to speedtest isn't central we'll make the other a relay
            if (serverUsed !== "Central") {
                // relay location will be the last 2 letters of the server name (country)
                let relay
                if (serverUsed === "US Server") {
                    relay = "us"
                }

                await writeConfig({ ...config, relay })
            }

            // cache the result to avoid making another speedtest in a short time span, this will overwrite any other "cache.json" file
            fs.writeFileSync("bins/librespeed-cli/cache.json", JSON.stringify({ ...result, date: new Date().toISOString() }), { encoding: "utf-8" })

            resolve(result)
        })

        speedtestProcess.stderr.setEncoding("utf8")
        speedtestProcess.stderr.on("data", data => {
            console.log("There was an error while performing the speedtest! Cannot continue.", data)
            cleanExit() // if we're here, the promise will never be resolved and we'll stop here at cleanExit
        })
    })
}
