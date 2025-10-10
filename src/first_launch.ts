import { config } from "./util/config"
import inquirer from "inquirer"
import cleanExit from "./util/clean_exit"
import { writeConfig } from "./util/config"
import { ISpeedtestResult, runSpeedtest } from "./util/speedtest"
import { runBenchmark } from "./util/benchmark"
import si from "systeminformation"
import { writeKeysFile } from "./util/keys"

export default async function runFirstLaunch() {
    console.log("Welcome to the o!rdr client!")
    console.log("Before you can help render osu! videos for o!rdr users, there are a few important steps to complete.")

    console.log("\nFirst, please ensure you have a stable and fast internet connection (at least 40 Mbps symmetric).")
    console.log("To keep o!rdr performant, all clients need to operate as fast as possible. Unfortunately, we cannot accept clients that do not meet this internet speed requirement.\n")

    // If a custom server is set, ignore speedtest
    let speedtestResult: ISpeedtestResult
    if (!config.dev) {
        speedtestResult = await runSpeedtest()
    } else {
        speedtestResult = { dl: "0", ul: "0", server: "None", resultUrl: "None" }
    }

    speedtestResult = await runSpeedtest()

    let { encodeWith } = await inquirer.prompt({
        name: "encodeWith",
        type: "list",
        message: "Choose your encoder: you'll generally want to use your GPU (NVIDIA or Intel), but if you have a very powerful CPU, then choosing CPU will result in faster renders.",
        choices: [
            { name: "CPU", value: "cpu" },
            { name: "NVIDIA GPU (NVENC)", value: "nvenc" },
            { name: "Intel GPU (QSV)", value: "qsv" }
        ],
        default: "cpu"
    })

    let encoderType: "cpu" | "gpu"
    if (encodeWith === "cpu") {
        encoderType = "cpu"
        await writeConfig({ ...config, encoder: "cpu" })
    } else if (encodeWith === "nvenc") {
        encoderType = "gpu"
        await writeConfig({ ...config, encoder: "nvenc" })
    } else {
        // qsv
        encoderType = "gpu"
        await writeConfig({ ...config, encoder: "qsv" })
    }

    console.log("\nWe need to run a quick benchmark of your computer to evaluate its performance.")
    console.log("It consists of running a render of a 30 second osu! replay using danser.")
    console.log("Please close every CPU/GPU intensive application running on your computer.")
    console.log("Press enter to proceed to the benchmark.\n")
    let { confirmedStartBenchmark } = await inquirer.prompt({
        name: "confirmedStartBenchmark",
        type: "confirm",
        message: "Continue?",
        default: true
    })
    if (!confirmedStartBenchmark) return await cleanExit()

    let benchmarkResult = await runBenchmark()

    let { clientName, ibAccount, contact } = await inquirer.prompt([
        {
            type: "input",
            name: "clientName",
            message: "Choose a name for your client. A good name could be (your username)'s PC for example. It will be shown on the o!rdr website.",
            validate: input => (input.trim() !== "" ? true : "Please enter a client name.")
        },
        {
            type: "input",
            name: "ibAccount",
            message: "Please enter your issou.best account username (case sensitive). This field is mandatory to be accepted. You will get rewarded e-sous for each video recorded and have your client stats on your issou.best account.",
            validate: input => (input.trim() !== "" ? true : "Please enter your issou.best account username.")
        },
        {
            type: "input",
            name: "contact",
            message: "Please enter your Discord username (make sure to be in the o!rdr Discord server). This field is mandatory to be accepted.",
            validate: input => (input.trim() !== "" ? true : "Please enter your Discord username.")
        }
    ])

    let cpuData = await si.cpu()
    let gpuData = await si.graphics()
    let cpu = `${cpuData.manufacturer} ${cpuData.brand} ${cpuData.speed} ${cpuData.cores}`
    let gpu!: string

    const allGPUs = gpuData.controllers.map(g => `${g.vendor} ${g.model}`).join(", ")

    // TODO next ver: the client shouldn't generate its own id, the server should make one for it
    const characters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_"
    let id = ""

    for (let i = 0; i < 21; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length)
        id += characters[randomIndex]
    }

    const clientData = {
        id,
        name: clientName,
        priority: benchmarkResult.averageFps,
        cpu,
        gpu: allGPUs,
        renderingType: encoderType,
        ibAccount,
        contact,
        speedtest: speedtestResult
    }

    let postClientUrl
    if (config.dev) {
        postClientUrl = config.dev.server.api + "/servers"
    } else {
        postClientUrl = "https://apis.issou.best/ordr/servers"
    }

    try {
        let response = await fetch(postClientUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(clientData)
        })

        if (response.status === 429) {
            console.log("You already applied 2 times in the last 12 hours. Wait a bit before sending a new renderer application or ask us to remove your limit over in our Discord server!")
            await cleanExit()
            return
        }

        if (!response.ok) {
            console.error(`Encountered an HTTP error ${response.status} while trying to send your client application! Please try again later.`)
            await cleanExit()
            return
        }
    } catch (err) {
        console.error("An error occured while trying to send your client application, please try again later", err)
        await cleanExit()
        return
    }

    await writeKeysFile({ client_id: id, osu: { oauth_client_id: "", oauth_client_secret: "" } })

    console.log("\nYour client key has been saved in the key.json file. Do not share it with anyone!")

    console.log("\nYour submission to help o!rdr was sent successfully! Once accepted, you can open this client and receive render jobs.")
    console.log("To get accepted, you need to join the o!rdr Discord server. You'll also receive a special Renderer role!")

    console.log("\nIf you have an osu! API (v2) key, you can add it to the keys.json file to receive jobs that require a scoreboard. You can request an API key for free on the osu! website.")
    console.log("If you have a powerful PC, you can also enable motion blur or 4K (UHD) capability in the config.json file to receive jobs that require these features.")
    console.log('If your upload speed to the o!rdr server is slow, you can try using a relay. Your client will upload generated videos to the relay instead. Check the "relay" setting in the client config.')
    console.log("\nAvailable relays:")
    console.log('- "us": United States, near New York')
    console.log('You can switch back to direct upload by setting "direct" instead.')
}
