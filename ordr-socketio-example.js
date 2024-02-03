const socketUrl = "https://apis.issou.best"
const io = require("socket.io-client")
const ioClient = io.connect(socketUrl, { path: "/ordr/ws" })

ioClient.on("render_done_json", data => {
    console.log(data)
})

ioClient.on("render_progress_json", data => {
    console.log(data)
})

ioClient.on("render_added_json", data => {
    console.log(data)
})

ioClient.on("render_failed_json", data => {
    console.log(data)
})
