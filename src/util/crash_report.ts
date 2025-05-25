import fs from "fs"
import { TRenderer } from "./startup_data"

/**
 * @param data the crash data to write
 * @description write a crash report in the crashes folder
 */
export default async function writeCrashReport(data: string, renderer: TRenderer) {
    let crashesFolder = "crashes"
    if (!fs.existsSync(crashesFolder)) fs.mkdirSync(crashesFolder)

    let date = new Date()
    let today = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}-${date.getDate().toString().padStart(2, "0")}-${date.getHours().toString().padStart(2, "0")}-${date.getMinutes().toString().padStart(2, "0")}-${date.getSeconds().toString().padStart(2, "0")}`

    fs.appendFileSync(`${crashesFolder}/${today}-crash-report.txt`, `${renderer} crash:\n${data}\n\n`, "utf-8")
}
