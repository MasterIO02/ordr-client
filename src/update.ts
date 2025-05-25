import inquirer from "inquirer"

/**
 * @description Update the client and exits the process.
 */
export default async function updateClient(): Promise<void> {
    console.log("UPDATE TODO")
    /*if (process.pkg) {
        console.log("The pre-compiled version does not support auto-update. Get the latest client at https://github.com/MasterIO02/ordr-client/releases")
        await exit()
    }

    let link = `https://dl.issou.best/ordr/client-latest.zip`

    let { confirmed } = await inquirer.prompt({
        name: "confirmed",
        type: "confirm",
        message: `Apply update? The client will download the latest files from ${link}.`,
        default: true
    })
    if (!confirmed) await exit()

    const outputZip = "files/client-latest.zip"

    await asyncDownload(link, outputZip, "client-latest", "file")
    await asyncExtract(outputZip, ".", "client-latest", "file")

    console.log("Finished updating the client. You can now restart it.")
    await exit()*/
}
