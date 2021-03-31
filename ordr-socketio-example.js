const socketUrl = "https://ordr-ws.issou.best"
const io = require("socket.io-client")
const ioClient = io.connect(socketUrl)

ioClient.on('render_done', (data) => {
    console.log(data)
})

ioClient.on('render_progress', (data) => {
    console.log(data)
})

ioClient.on('render_added', (data) => {
    console.log(data)
})
