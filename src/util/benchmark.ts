import fs from "fs"
import downloadFile from "./download_file"
import { spawn } from "child_process"
import cleanExit from "./clean_exit"
import { prepareDanserRender } from "../renderers/danser/prepare"
import { config } from "./config"

export interface IBenchmarkResult {
    averageFps: number
}

/**
 * @description Run a benchmark using danser
 */
export async function runBenchmark(): Promise<IBenchmarkResult> {
    // download the beatmapset for the benchmark if it doesn't exist
    if (!fs.existsSync("data/songs/894883") && !fs.existsSync("data/songs/894883.osk")) {
        await downloadFile({ url: "https://dl.issou.best/ordr/maps/894883.osz", to: "data/songs" })
    }

    // download the replay for the benchmark if it doesn't already exist
    if (!fs.existsSync("data/replays/BENCHMARK-replay-osu_1869933_2948907816.osr")) {
        await downloadFile({ url: "https://dl.issou.best/ordr/replays/BENCHMARK-replay-osu_1869933_2948907816.osr", to: "data/replays" })
    }

    await prepareDanserRender() // no parameter to only set the encoder and paths

    return await new Promise(resolve => {
        let danserArguments = ["-replay", `${process.cwd()}/data/replays/BENCHMARK-replay-osu_1869933_2948907816.osr`, "-record"]
        let danserExecutable = process.platform === "win32" ? "./danser-cli.exe" : "./danser-cli"

        let fpsHistory: number[] = []

        const danser = spawn(danserExecutable, danserArguments, { cwd: "bins/danser" })
        danser.stdout.setEncoding("utf8")
        danser.stdout.on("data", (data: string) => {
            if (config.debug) {
                console.log(data)
            } else if (data.includes("Progress")) {
                console.log(data.replaceAll("\n", ""))
            }

            if (data.includes("Finished.")) {
                // make an average out of all fps values we got during the render
                fpsHistory = fpsHistory.map(i => Number(i))
                let averageFps = Math.round(fpsHistory.reduce((prev, curr) => prev + curr, 0) / fpsHistory.length)
                console.log(`Benchmark done. Average FPS was ${averageFps}.`)
                return resolve({ averageFps })
            }

            if (data.split(" ")[2] === "panic:") {
                console.log("danser crashed:", data)
                cleanExit()
            }
        })
        danser.stderr.setEncoding("utf8")
        danser.stderr.on("data", (data: string) => {
            if (data.includes("bitrate") && data.includes("frame")) {
                // retrieve and parse all fps values in ffmpeg logs
                if (config.debug) console.log(data)
                let parsedFps = /(?<=\bfps=\s)(\w+)/.exec(data)
                if (parsedFps !== null) {
                    let fps = Number(parsedFps[0])
                    if (fps < 1000 && fps >= 1) {
                        fpsHistory.push(fps)
                    }
                } else {
                    parsedFps = /(?<=\bfps=)(\w+)/.exec(data)
                    if (!parsedFps) {
                        console.log("Couldn't parse FPS from FFmpeg's log line!")
                        return
                    }
                    let fps = Number(parsedFps[0])
                    if (fps < 1000 && fps >= 1) {
                        fpsHistory.push(fps)
                    }
                }
            }
        })
    })
}
