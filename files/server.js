const socketUrl = "https://ordr-clients.issou.best"
const io = require("socket.io-client")
const dataProcessor = require('./dataProcessor')
const config = require('../config.json')
const version = 5

exports.startServer = async () => {
    const ioClient = io.connect(socketUrl)

    console.log("Server started!")

    setTimeout(() => {
        if (!ioClient.connected) {
            console.log("Cannot connect to the o!rdr server. Trying to connect...")
        }
    }, 2000)


    ioClient.on('connect', () => {
        console.log("Connected to the o!rdr server!")
        ioClient.emit("id", config.id, version, config.usingOsuApi, config.motionBlurCapable)
    })

    ioClient.on('disconnect', () => {
        console.log('We are disconnected from the server! Trying to reconnect...')
    })

    ioClient.on('data', (data) => {
        dataProcessor(data)
    })

    ioClient.on('version_too_old', () => {
        console.log('This version of o!rdr-client is too old! Please update.')
        process.exit()
    })

    ioClient.on("connect_error", (err) => {
        if (config.debugLogs) {
            console.log(`Connection error: ${err.message}`);
        }
    });
}

exports.sendProgression = (data) => {
    const ioClient = io.connect(socketUrl)
    ioClient.emit("progression", {
        id: config.id,
        progress: data
    })
}