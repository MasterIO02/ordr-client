import inquirer from "inquirer"
import cleanExit from "./clean_exit"
import { writeConfig, config } from "./config"
import downloadFile from "./download_file"
import extractFile from "./extract_file"
import { spawn } from "child_process"
import fs from "fs"

export interface ISpeedtestResult {
    dl: string
    ul: string
    server: string
    resultUrl: string
}

// TODO: cache speedtest result of first launch
export async function runSpeedtest(): Promise<ISpeedtestResult> {
    console.log("Before running the benchmark, the o!rdr client needs to perform a speedtest to the o!rdr server.")
    console.log("The result of this speedtest will be sent to the o!rdr server along with your benchmark results.")
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

        const speedtestProcess = spawn(`bins/librespeed-cli/${binaryName}`, ["--share", "--telemetry-level", "full", "--telemetry-server", "http://speedtest.issou.best", "--telemetry-path", "/results/telemetry.php", "--telemetry-share", "/results/", "--duration", "10", "--json", "--local-json", `./config.json`], { cwd: "bins/librespeed-cli" })
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
            resolve(result)
        })

        speedtestProcess.stderr.setEncoding("utf8")
        speedtestProcess.stderr.on("data", data => {
            console.log("There was an error while performing the speedtest! Cannot continue.", data)
            cleanExit() // if we're here, the promise will never be resolved and we'll stop here at cleanExit
        })
    })
}
