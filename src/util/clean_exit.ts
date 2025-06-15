import { disconnectWebsocket } from "../websocket"

/**
 * @description Prompt the user to press any key to exit. The process will not terminate until a key has been pressed. Disconnects from the o!rdr client websocket
 */
export default async function cleanExit() {
    disconnectWebsocket()

    process.stdin.setRawMode(true)
    process.stdin.resume()

    console.log("Press any key to exit.")

    await new Promise(resolve => {
        process.stdin.once("data", () => {
            process.stdin.setRawMode(false)
            process.stdin.pause()
            resolve(true)
            process.exit(0)
        })
    })
}
