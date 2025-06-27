import inquirer from "inquirer"
import cleanExit from "./util/clean_exit"
import downloadFile from "./util/download_file"
import fs from "fs"
import extractFile from "./util/extract_file"
import AdmZip from "adm-zip"
import { spawn } from "child_process"
import fsExtra from "fs-extra"

/**
 * @description Update the client to the version provided from GitHub and exits the process.
 */
export default async function updateClient(version: number): Promise<void> {
    // TODO: if pkg, then download new executable for this system
    if ((process as any).pkg) {
    } else {
        await updateSource(version)
    }
}

async function updateSource(version: number) {
    const sourceUrl = `https://github.com/MasterIO02/ordr-client/archive/refs/tags/v${version}.zip`

    let { confirmed } = await inquirer.prompt({
        name: "confirmed",
        type: "confirm",
        message: `Apply update? The client will download the latest files from ${sourceUrl}.`,
        default: true
    })
    if (!confirmed) await cleanExit()

    // backup the current client code
    if (!fs.existsSync("backup")) fs.mkdirSync("backup")
    const backupDir = `backup/${new Date().toISOString().slice(0, 10)}`
    if (fs.existsSync(backupDir)) {
        // not updating the client if there's already a folder with the current day in the backup folder, that would most likely mean the previous update failed
        console.error("Did the previous update fail, or was the client already updated today? Please update the client manually, can't continue.")
        await cleanExit()
    }

    try {
        fs.mkdirSync(backupDir)
        fs.cpSync("src", `${backupDir}/src`, { recursive: true })
        fs.cpSync("package.json", `${backupDir}/package.json`)
        fs.cpSync("package-lock.json", `${backupDir}/package-lock.json`)
        fs.cpSync("tsconfig.json", `${backupDir}/tsconfig.json`)
    } catch (err) {
        console.error("Couldn't backup the client before running the update! Can't continue.", err)
        await cleanExit()
    }

    // download and apply update
    await downloadFile({ url: sourceUrl, to: ".", filename: "client-update.zip", exitOnFail: true })

    // github adds a subfolder inside of the zip file, we need to know its name
    const updateZip = new AdmZip("./client-update.zip")
    const updateZipEntries = updateZip.getEntries()
    const updateSubfolderName = updateZipEntries[0].entryName.replace("/", "")

    await extractFile({ input: "./client-update.zip", output: "." })

    try {
        fsExtra.cpSync(updateSubfolderName, ".", { recursive: true }) // this overwrite files from the update folder to the root client folder
        fs.rmSync(updateSubfolderName, { recursive: true, force: true }) // remove the extracted update folder
    } catch (err) {
        console.error("Couldn't update the client! Can't continue.", err)
        await cleanExit()
    }

    // run npm install to install dependencies
    let depInstalled = await new Promise<boolean>((resolve, _) => {
        let depInstallProcess = spawn("npm", ["install"])
        depInstallProcess.stdout.setEncoding("utf-8")
        depInstallProcess.stdout.on("data", (data: string) => {
            console.log(data)
        })
        depInstallProcess.stderr.setEncoding("utf-8")
        depInstallProcess.stderr.on("data", (data: string) => {
            console.error(data)
        })
        depInstallProcess.on("exit", () => {
            resolve(true)
        })
        depInstallProcess.on("error", () => {
            resolve(false)
        })
    })

    if (!depInstalled) {
        console.error("Couldn't install the dependencies of the client. Please try running 'npm install' manually, or check the console for more information.")
    } else {
        console.log("Finished updating the client. You can now restart it.")
    }

    await cleanExit()
}

async function updateExecutable(version: number) {}
