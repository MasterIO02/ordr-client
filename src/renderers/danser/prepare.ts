import { TStartupData } from "../../util/startup_data"
import validateFiles from "../../util/validate_files"
import updateDanser from "./update"
import fs from "fs"
import { spawn } from "child_process"

/**
 * @description Prepare danser to be used with the client (check version, download binaries, create folders, generate configs...)
 */
export default async function prepareDanser(startupData: TStartupData) {
    if (!fs.existsSync("bins/danser")) fs.mkdirSync("bins/danser")

    let validatedFiles = await validateFiles(startupData.validateFiles, "danser")

    // TODO: test if this triggers if the danser folder is not present anymore
    if (!validatedFiles) {
        console.log("The version of danser is too old or corrupted, updating now")
        await updateDanser(startupData.danserVersion)
    }

    // checking for custom folder paths at every run to make sure they're all there (user could have deleted some)
    if (!fs.existsSync("bins/danser/songs")) fs.mkdirSync("bins/danser/songs")
    if (!fs.existsSync("bins/danser/skins")) fs.mkdirSync("bins/danser/skins", { recursive: true })
    if (!fs.existsSync("bins/danser/osrs")) fs.mkdirSync("bins/danser/osrs")
    if (!fs.existsSync("bins/danser/videos")) fs.mkdirSync("bins/danser/videos")

    // run danser empty once to make sure it can open
    await new Promise(resolve => {
        let danserProcess = spawn("./danser-cli", ["-settings=", "-noupdatecheck"], { cwd: "bins/danser" })
        danserProcess.addListener("exit", () => {
            resolve(true)
        })
        danserProcess.on("error", err => {
            console.error("An error occured while trying to test run danser", err)
            process.exit(1)
        })
    })
}
