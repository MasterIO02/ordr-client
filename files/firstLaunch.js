module.exports = async () => {
    const fs = require("fs")
    const axios = require("axios")
    var spawn = require("child_process").spawn
    const inquirer = require("inquirer")
    const wget = require("wget-improved")
    const config = require("../config.json")
    const settingsGenerator = require("./settingsGenerator")
    const danserUpdater = require("./danserUpdater")
    var avgFps, renderingType, danserExecutable, serverUrl

    if (config.customServer && config.customServer.apiUrl !== "") {
        serverUrl = config.customServer.apiUrl + "/servers"
    } else {
        serverUrl = "https://ordr-api.issou.best/servers"
    }

    await axios.request(serverUrl).catch(error => {
        if (!error.status) {
            console.log("Network error. Maybe the o!rdr server is offline or you are not connected to Internet.")
            process.exit()
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
            fs.mkdirSync("files/danser")
        }
        await danserUpdater(() => {
            startFirstLaunch()
        })
    }

    async function startFirstLaunch() {
        setTimeout(() => {
            console.log("By using o!rdr client sending your PC CPU and GPU model is required.")
            console.log("Be sure to have a good internet connection (>10mbps upload preferably) to upload the videos that danser renders.")
            console.log("Be aware that o!rdr client will regularly download and upload files such as replays, skins and video files.")
            console.log("If you move o!rdr client to another folder don't forget to update the paths in the config.json file.")
            chooseRenderingType()
        }, 1000)
    }

    async function writeConfig() {
        fs.writeFileSync("./config.json", JSON.stringify(config, null, 1), "utf-8", err => {
            if (err) throw err
        })
    }

    async function chooseRenderingType() {
        await inquirer
            .prompt([
                {
                    name: "renderType",
                    type: "list",
                    message: "Choose your rendering type:",
                    choices: ["CPU", "NVIDIA GPU (NVENC)", "AMD GPU (VCE)", "Intel GPU (QSV)"],
                    default: "CPU"
                }
            ])
            .then(answers => {
                if (answers.renderType === "CPU") {
                    renderingType = "cpu"
                    config.encoder = "cpu"
                    writeConfig()
                    settingsGenerator("change")
                } else if (answers.renderType === "NVIDIA GPU (NVENC)") {
                    renderingType = "gpu"
                    config.encoder = "nvidia"
                    writeConfig()
                    settingsGenerator("change")
                } else if (answers.renderType === "AMD GPU (VCE)") {
                    renderingType = "gpu"
                    config.encoder = "amd"
                    writeConfig()
                    settingsGenerator("change")
                } else if (answers.renderType === "Intel GPU (QSV)") {
                    renderingType = "gpu"
                    config.encoder = "intel"
                    writeConfig()
                    settingsGenerator("change")
                }
                console.log("Before registering to o!rdr a quick benchmark of your system is required.")
                console.log("The benchmark consists of running a render of a 30 second replay using danser.")
                console.log("Please close every CPU/GPU intensive application running on your computer.")
                console.log("Press enter to proceed to the benchmark.")
                inquirer
                    .prompt([
                        {
                            name: "continue",
                            type: "confirm",
                            message: "Continue?",
                            default: true
                        }
                    ])
                    .then(answers => {
                        if (answers.continue) {
                            setTimeout(() => {
                                downloadBenchMap()
                            }, 4000)
                        } else {
                            process.exit()
                        }
                    })
            })
    }

    function downloadBenchMap() {
        if (!fs.existsSync(`${config.danserSongsDir}}/894883/`) || !fs.existsSync(`${config.danserSongsDir}/894883.osk`)) {
            const link = `https://dl.issou.best/ordr/maps/894883.osz`
            const output = `${config.danserSongsDir}/894883.osz`
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
        if (!fs.existsSync(`${config.rawReplaysPath}/BENCHMARK-replay-osu_1869933_2948907816.osr`)) {
            const link = `https://dl.issou.best/ordr/replays/BENCHMARK-replay-osu_1869933_2948907816.osr`
            const output = `${config.rawReplaysPath}/BENCHMARK-replay-osu_1869933_2948907816.osr`
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
        const danser = spawn(config.danserPath, danserArguments)
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
            if (data.includes("panic")) {
                console.log(data)
            }
        })
        // thanks ffmpeg to output progression in stderr, can't inform real errors
        danser.stderr.setEncoding("utf8")
        danser.stderr.on("data", data => {
            if (data.includes("panic")) {
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

    async function sendServer() {
        const si = require("systeminformation")
        const { nanoid } = require("nanoid")

        var serverName, contact
        await inquirer
            .prompt([
                {
                    name: "serverName",
                    message: "What do you want for your server name?",
                    default: "No name = rejection. A good name could be (your username)'s PC for example."
                },
                {
                    name: "contact",
                    message: "Please enter a way of contacting you in case something goes wrong (your Discord username+tag for example)",
                    default: "No way of contacting you = rejection"
                }
            ])
            .then(answers => {
                serverName = answers.serverName
                contact = answers.contact
            })

        var cpu, gpu
        async function getSysInfo() {
            await si.cpu().then(data => {
                cpu = `${data.manufacturer} ${data.brand} ${data.speed} ${data.cores}`
            })
            await si.graphics().then(data => {
                gpu = `${data.controllers[0].vendor} ${data.controllers[0].model}`
            })
        }
        await getSysInfo()

        const id = {
            id: nanoid()
        }

        const server = {
            id: id,
            name: serverName,
            priority: avgFps,
            cpu: cpu,
            gpu: gpu,
            renderingType: renderingType,
            contact: contact
        }

        await axios
            .post(serverUrl, server)
            .then(() => {
                console.log("Your server ID is generated in the config.json file, do not share it with anyone.")
                console.log("Your submission for helping o!rdr got sent successfully! Once accepted, you can open this client and get render jobs.")
                console.log("You can send a message in the o!rdr Discord server to get accepted faster, but generally it does not take more than a day or two.")
                console.log("If you have an osu! api v1 key, you can add it to the config file and get jobs which requires a scoreboard. (you can request an API key for free on the osu! website)")
                console.log('If you have a powerful PC, you can also enable the motionBlurCapable setting in the config file, it will get you jobs that requires a "960fps" video.')
            })
            .catch(error => {
                if (error.response) {
                    console.log(`Something wrong happened! ${error}`)
                    process.exit()
                }
            })

        config.id = JSON.stringify(id.id).replace(/"/g, "")
        await writeConfig()
    }
}
