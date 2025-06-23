import { config } from "./util/config"
import inquirer from "inquirer"
import cleanExit from "./util/clean_exit"
import { writeConfig } from "./util/config"
import { ISpeedtestResult, runSpeedtest } from "./util/speedtest"
import { runBenchmark } from "./util/benchmark"
import si from "systeminformation"
import { nanoid } from "nanoid"
import { writeKeyFile } from "./util/key"

// TODO: test first launch!

export default async function runFirstLaunch() {
    console.log("By using the o!rdr client sending your PC CPU and GPU model is required (this process is automatic).")
    console.log("Make sure to have a good internet connection (20mbps symmetric minimum) to upload the rendered videos at reasonable speed..")
    console.log("Be aware that the o!rdr client will regularly download and upload files such as replays, skins and video files.")

    // If a custom server is set, ignore speedtest
    let speedtestResult: ISpeedtestResult
    if (!config.dev) {
        speedtestResult = await runSpeedtest()
    } else {
        speedtestResult = { dl: "0", ul: "0", server: "None", resultUrl: "None" }
    }

    let { encodeWith } = await inquirer.prompt({
        name: "encodeWith",
        type: "list",
        message: "Choose your encoder: generally you'll want to use your GPU (NVIDIA or Intel), but if you have a very powerful CPU, then choosing CPU will result in faster renders.",
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

    console.log("Before sending your application a quick benchmark of your system is required.")
    console.log("The benchmark consists of running a render of a 30 second replay using danser.")
    console.log("Please close every CPU/GPU intensive application running on your computer.")
    console.log("Press enter to proceed to the benchmark.")
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
            name: "clientName",
            message: "Choose a name for your client. A good name could be (your username)'s PC for example. It will be shown on the o!rdr website.",
            validate: input => (input.trim() !== "" ? true : "Please enter a client name.")
        },
        {
            name: "ibAccount",
            message: "Please enter your issou.best account username (case sensitive). This field is mandatory to be accepted. You will get rewarded e-sous for each video recorded and have your client stats on your issou.best account.",
            validate: input => (input.trim() !== "" ? true : "Please enter your issou.best account username.")
        },
        {
            name: "contact",
            message: "Please enter your Discord username (make sure to be in the o!rdr Discord server). This field is mandatory to be accepted.",
            validate: input => (input.trim() !== "" ? true : "Please enter your Discord username.")
        }
    ])

    let cpuData = await si.cpu()
    let gpuData = await si.graphics()
    let cpu = `${cpuData.manufacturer} ${cpuData.brand} ${cpuData.speed} ${cpuData.cores}`
    let gpu!: string

    // search in found GPUs if the one selected as the encoder is available
    for (const controller of gpuData.controllers) {
        let matchVendor!: string
        if (config.encoder === "nvenc") {
            matchVendor = "nvidia"
        } else if (config.encoder === "qsv") {
            matchVendor = "intel"
        } else {
            return // exit the loop, we'll take the 1st gpu found
        }
        if (controller.vendor.toLowerCase().includes(matchVendor)) {
            gpu = `${controller.vendor} ${controller.model}`
        }
    }

    // take the 1st found gpu if we didn't match one
    if (!gpu) {
        gpu = `${gpuData.controllers[0].vendor} ${gpuData.controllers[0].model}`
    }

    // TODO next ver: the client shouldn't generate its own id, the server should make one for it
    const id = nanoid()

    const clientData = {
        id,
        name: clientName,
        priority: benchmarkResult.averageFps,
        cpu,
        gpu,
        renderingType: encoderType,
        ibAccount,
        contact,
        speedtest: speedtestResult
    }

    let postClientUrl
    if (config.dev) {
        postClientUrl = config.dev.server.api + "/ordr/servers"
    } else {
        postClientUrl = "https://apis.issou.best/ordr/servers"
    }

    try {
        let response = await fetch(postClientUrl, {
            method: "POST",
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

    await writeKeyFile({ id })

    console.log("Your client key has been saved in the key.json file. Do not share it with anyone!")

    console.log("\nYour submission to help o!rdr was sent successfully! Once accepted, you can open this client and receive render jobs.")
    console.log("To get accepted, you need to join the o!rdr Discord server. You'll also receive a special Renderer role!")

    console.log("\nIf you have an osu! API (v2) key, you can add it to the config file to receive jobs that require a scoreboard. You can request an API key for free on the osu! website.")
    console.log("If you have a powerful PC, you can also enable motion blur or 4K (UHD) capability in the config.json file to receive jobs that require these features.")
    console.log('If your upload speed to the o!rdr server is slow, you can try using a relay. Your client will upload generated videos to the relay instead. Check the "relay" setting in the client config.')
    console.log("\nAvailable relays:")
    console.log('- "us": United States, near New York')
    console.log('You can switch back to direct upload by setting "direct" instead.')
}
