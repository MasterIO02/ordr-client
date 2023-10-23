const fs = require("fs")
const axios = require("axios")
var spawn = require("child_process").spawn
const inquirer = require("inquirer")
const wget = require("wget-improved")
const config = require(process.cwd() + "/config.json")
const settingsGenerator = require("./settingsGenerator")
const danserUpdater = require("./danserUpdater")
const { exit, asyncExtract } = require("./util")

module.exports = async () => {
    let avgFps, renderingType, danserExecutable, serverUrl
    let speedtestResult = {
        dl: "",
        ul: "",
        server: "",
        resultUrl: ""
    }

    if (config.customServer && config.customServer.apiUrl !== "") {
        serverUrl = config.customServer.apiUrl + "/servers"
    } else {
        serverUrl = "https://apis.issou.best/ordr/servers"
    }

    await axios.request(serverUrl).catch(async error => {
        if (!error.status) {
            console.log("Network error. Maybe the o!rdr server is offline or you are not connected to Internet.")
            await exit()
        }
    })

    console.log("Preparing danser for using with o!rdr client...")

    if (process.platform === "win32") {
        danserExecutable = "files/danser/danser.exe"
    } else {
        danserExecutable = "files/danser/danser"
    }
    if (fs.existsSync(danserExecutable)) {
        if (!fs.existsSync("files/danser/Songs")) {
            await settingsGenerator("new")
        }
        startFirstLaunch()
    } else {
        if (!fs.existsSync("files/danser")) {
            if (!fs.existsSync("files")) fs.mkdirSync(process.cwd() + "/files")
            fs.mkdirSync(process.cwd() + "/files/danser")
        }
        const { data: data } = await axios.get("http://apis.issou.best/ordr/dansermd5")
        danserUpdater(() => {
            startFirstLaunch()
        }, data.version)
    }

    async function startFirstLaunch() {
        console.log("By using the o!rdr client sending your PC CPU and GPU model is required (this process is automatic).")
        console.log("Make sure to have a good internet connection (20mbps symmetric minimum) to upload the rendered videos at reasonable speed..")
        console.log("Be aware that the o!rdr client will regularly download and upload files such as replays, skins and video files.")

        // If a custom server is set, ignore speedtest
        if ((config.customServer && config.customServer.apiUrl === "") || config.dev) {
            downloadLibrespeedCli()
        } else {
            chooseRenderingType()
        }
    }

    async function writeConfig() {
        fs.writeFileSync("./config.json", JSON.stringify(config, null, 1), "utf-8", err => {
            if (err) throw err
        })
    }

    async function chooseRenderingType() {
        let { renderType } = await inquirer.prompt({
            name: "renderType",
            type: "list",
            message: "Choose your rendering type:",
            choices: ["CPU", "NVIDIA GPU (NVENC)", "Intel GPU (QSV)"],
            default: "CPU"
        })

        async function confirmed() {
            console.log("Before sending your application a quick benchmark of your system is required.")
            console.log("The benchmark consists of running a render of a 30 second replay using danser.")
            console.log("Please close every CPU/GPU intensive application running on your computer.")
            console.log("Press enter to proceed to the benchmark.")
            let { confirmedPrompt } = await inquirer.prompt({
                name: "confirmedPrompt",
                type: "confirm",
                message: "Continue?",
                default: true
            })
            if (confirmedPrompt) {
                downloadBenchMap()
            } else {
                await exit()
            }
        }

        switch (renderType) {
            case "CPU":
                renderingType = "cpu"
                config.encoder = "cpu"
                writeConfig()
                settingsGenerator("change", "", false, () => {
                    confirmed()
                })
                break
            case "NVIDIA GPU (NVENC)":
                renderingType = "gpu"
                config.encoder = "nvidia"
                writeConfig()
                settingsGenerator("change", "", false, () => {
                    confirmed()
                })
                break
            case "Intel GPU (QSV)":
                renderingType = "gpu"
                config.encoder = "intel"
                writeConfig()
                settingsGenerator("change", "", false, () => {
                    confirmed()
                })
                break
        }
    }

    function downloadBenchMap() {
        if (!fs.existsSync(`${process.cwd()}/files/danser/Songs/894883/`) || !fs.existsSync(`${process.cwd()}/files/danser/Songs/894883.osk`)) {
            const link = `https://dl.issou.best/ordr/maps/894883.osz`
            const output = `${process.cwd()}/files/danser/Songs/894883.osz`
            let download = wget.download(link, output)
            download.on("error", err => {
                console.log(err)
            })
            download.on("start", fileSize => {
                console.log(`Downloading the benchmark map (894883) at ${link}: ${fileSize} bytes to download...`)
            })
            download.on("end", () => {
                console.log(`Finished downloading the benchmark map.`)
                downloadBenchReplay()
            })
        } else {
            console.log("The benchmark map already exists.")
            downloadBenchReplay()
        }
    }

    function downloadBenchReplay() {
        if (!fs.existsSync(`${process.cwd()}/files/danser/rawReplays/BENCHMARK-replay-osu_1869933_2948907816.osr`)) {
            const link = `https://dl.issou.best/ordr/replays/BENCHMARK-replay-osu_1869933_2948907816.osr`
            const output = `${process.cwd()}/files/danser/rawReplays/BENCHMARK-replay-osu_1869933_2948907816.osr`
            let download = wget.download(link, output)
            download.on("error", err => {
                console.log(err)
            })
            download.on("start", fileSize => {
                console.log(`Downloading the benchmark replay at ${link}: ${fileSize} bytes to download...`)
            })
            download.on("end", () => {
                console.log(`Finished downloading the benchmark replay.`)
                startBenchmark()
            })
        } else {
            console.log("Benchmark replay already exists.")
            startBenchmark()
        }
    }

    function startBenchmark() {
        var danserArguments = ["-replay", "rawReplays/BENCHMARK-replay-osu_1869933_2948907816.osr", "-record"]
        const danser = spawn("./danser", danserArguments, { cwd: "files/danser" })
        var fpsHistory = [],
            fps
        danser.stdout.setEncoding("utf8")
        danser.stdout.on(`data`, data => {
            if (data.includes("Progress")) {
                console.log(data)
            }
            if (data.includes("Finished.")) {
                fpsHistory = fpsHistory.map(i => Number(i))
                avgFps = Math.round(fpsHistory.reduce((prev, curr) => prev + curr, 0) / fpsHistory.length)
                console.log(`Benchmark done. Average FPS was ${avgFps}.`)
                sendServer()
            }
            if (data.split(" ")[2] === "panic:") {
                console.log(data)
            }
        })
        // thanks ffmpeg to output progression in stderr, can't inform real errors
        danser.stderr.setEncoding("utf8")
        danser.stderr.on("data", data => {
            if (data.split(" ")[2] === "panic:") {
                console.log(data)
            }
            if (data.includes("bitrate") && data.includes("frame")) {
                console.log(data)
                fps = /(?<=\bfps=\s)(\w+)/.exec(data)
                if (fps !== null) {
                    if (fps[0] < 1000 && fps[0] >= 1) {
                        fpsHistory.push(fps[0])
                    }
                } else {
                    fps = /(?<=\bfps=)(\w+)/.exec(data)
                    if (fps[0] < 1000 && fps[0] >= 1) {
                        fpsHistory.push(fps[0])
                    }
                }
            }
        })
    }

    async function runSpeedtest() {
        // write config file in librespeed-cli folder
        const configFile = `${process.cwd()}/files/librespeed-cli/config.json`
        const libreConfig = [
            {
                id: 1,
                name: "o!rdrFR",
                server: "http://st1.issou.best/",
                dlURL: "garbage.php",
                ulURL: "empty.php",
                pingURL: "empty.php",
                getIpURL: "getIP.php"
            },
            {
                id: 2,
                name: "o!rdrUS",
                server: "http://st2.issou.best/",
                dlURL: "garbage.php",
                ulURL: "empty.php",
                pingURL: "empty.php",
                getIpURL: "getIP.php"
            }
        ]
        fs.writeFileSync(configFile, JSON.stringify(libreConfig))

        // Run speedtest
        console.log("Running speedtest...")
        const speedtest = spawn(`${process.cwd()}/files/librespeed-cli/librespeed-cli` + (process.platform === "win32" ? ".exe" : ""), [
            "--share",
            "--telemetry-level",
            "full",
            "--telemetry-server",
            "http://speedtest.issou.best",
            "--telemetry-path",
            "/results/telemetry.php",
            "--telemetry-share",
            "/results/",
            "--duration",
            "10",
            "--json",
            "--local-json",
            `${process.cwd()}/files/librespeed-cli/config.json`
        ])
        speedtest.stdout.setEncoding("utf8")
        speedtest.stdout.on("data", async data => {
            const parsedData = JSON.parse(data)
            speedtestResult.dl = parsedData[0].download.toString()
            speedtestResult.ul = parsedData[0].upload.toString()
            speedtestResult.server = parsedData[0].server.name
            speedtestResult.resultUrl = parsedData[0].share
            console.log(`Download: ${speedtestResult.dl} Mbps`)
            console.log(`Upload: ${speedtestResult.ul} Mbps`)
            console.log(`Server: ${speedtestResult.server}`)
            console.log(`Result link: ${speedtestResult.resultUrl}`)

            // If a relay was deemed faster, write it to the config.
            const serverUsed = parsedData[0].server.name
            if (serverUsed !== "o!rdrFR") {
                // relay location will be the last 2 letters of the server name (country)
                const relay = serverUsed.split("o!rdr").pop()

                config.relay = relay
                writeConfig()
            }

            // prompt user if they want to continue
            const cont = await inquirer.prompt([
                {
                    type: "confirm",
                    name: "continue",
                    message: "Do you want to continue?",
                    default: true
                }
            ])

            if (cont.continue) {
                chooseRenderingType()
            } else {
                await exit()
            }
        })

        speedtest.stderr.setEncoding("utf8")
        speedtest.stderr.on("data", () => {
            console.log("There was an error performing the speedtest, skipping...")
            chooseRenderingType()
        })
    }

    async function downloadLibrespeedCli() {
        console.log("Before running the benchmark, the o!rdr client needs to perform a speedtest to the o!rdr server.")
        console.log("The result of this speedtest will be sent to the o!rdr server along with your benchmark results.")
        let { confirmedPrompt } = await inquirer.prompt({
            name: "confirmedPrompt",
            type: "confirm",
            message: "Continue?",
            default: true
        })
        if (!confirmedPrompt) await exit()

        // set different links for different platforms (windows, linux, mac)
        let link
        const platform = process.platform
        if (platform === "win32") {
            link = "http://dl.issou.best/ordr/librespeed-cli-win.zip"
        } else if (platform === "linux") {
            link = "http://dl.issou.best/ordr/librespeed-cli-linux.zip"
        }

        // make directory for speedtest-cli if it doesn't exist
        if (!fs.existsSync(`${process.cwd()}/files/librespeed-cli`)) {
            fs.mkdirSync(`${process.cwd()}/files/librespeed-cli`)
        }

        if (fs.existsSync(`${process.cwd()}/files/librespeed-cli/librespeed-cli` + (platform === "win32" ? ".exe" : ""))) {
            console.log("Librespeed-cli already exists.")
            return runSpeedtest()
        }

        const output = `${process.cwd()}/files/librespeed-cli/librespeed-cli.zip`
        let download = wget.download(link, output)

        download.on("error", () => {
            console.log("There was an error downloading librespeed-cli.")
        })

        download.on("start", fileSize => {
            console.log(`Downloading librespeed-cli at ${link}: ${fileSize} bytes to download...`)
        })

        download.on("end", () => {
            console.log(`Finished downloading librespeed-cli.`)

            // unzip librespeed-cli
            console.log(`Unzipping librespeed-cli...`)

            asyncExtract(`${process.cwd()}/files/librespeed-cli/librespeed-cli.zip`, `${process.cwd()}/files/librespeed-cli/`, "librespeed")
                .then(() => {
                    console.log(`Finished unzipping librespeed-cli.`)

                    // chmod when on linux
                    if (process.platform === "linux") fs.chmodSync("files/librespeed-cli/librespeed-cli", "755")

                    runSpeedtest()
                })
                .catch(err => {
                    console.error(err)
                })
        })
    }

    async function sendServer() {
        const si = require("systeminformation")
        const { nanoid } = require("nanoid")

        let serverName, ibAccount, contact
        ;({ serverName } = await inquirer.prompt({
            name: "serverName",
            message: "What do you want for your server name?",
            default: "A good name could be (your username)'s PC for example."
        }))

        if (config.customServer.apiUrl === "" || config.dev) {
            ;({ ibAccount, contact } = await inquirer.prompt([
                {
                    name: "ibAccount",
                    message: "Please enter your issou.best account username. This field is mandatory to be accepted. You will get rewarded e-sous for each video recorded and have your client stats on your issou.best account.",
                    default: "x"
                },
                {
                    name: "contact",
                    message: "Please enter your Discord username (make sure to be in the o!rdr Discord server). This field is mandatory to be accepted.",
                    default: "x"
                }
            ]))
        }

        var cpu, gpu
        async function getSysInfo() {
            await si.cpu().then(data => {
                cpu = `${data.manufacturer} ${data.brand} ${data.speed} ${data.cores}`
            })
            await si.graphics().then(data => {
                for (const controller of data.controllers) {
                    if (controller.vendor.toLowerCase().includes(config.encoder)) {
                        gpu = `${controller.vendor} ${controller.model}`
                    }
                }
                if (!gpu) {
                    gpu = `${data.controllers[0].vendor} ${data.controllers[0].model}`
                }
            })
        }
        await getSysInfo()

        const id = nanoid()

        const server = {
            id,
            name: serverName,
            priority: avgFps,
            cpu,
            gpu,
            renderingType,
            ibAccount,
            contact,
            speedtest: speedtestResult
        }

        try {
            await axios.post(serverUrl, server)
            console.log("Your server ID is generated in the config.json file, do not share it with anyone.")
            if (config.customServer.apiUrl === "" || config.dev) {
                console.log("Your submission for helping o!rdr got sent successfully! Once accepted, you can open this client and get render jobs.")
                console.log("You need to join the o!rdr Discord server to get accepted, you'll have a cool role :)")
                console.log("If you have an osu! api v1 key, you can add it to the config file and get jobs which requires a scoreboard. (you can request an API key for free on the osu! website)")
                console.log('If you have a powerful PC, you can also enable the motionBlurCapable setting in the config file, it will get you jobs that requires a "960fps" video.')
                console.log('If you have a bad upload speed to the o!rdr server you can try using a relay: your client will upload the video to it instead. Check the "relay" setting in the client config.')
                console.log('The only currently available relay is "us" (in the USA, near NYC). You can go back to direct upload by using "direct" instead.')
            }
            config.id = id
            await writeConfig()
            exit()
        } catch (err) {
            if (err.response) {
                console.log(`Something wrong happened! ${err}`)
                exit()
            }
        }
    }
}
