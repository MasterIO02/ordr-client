//const socketUrl = "https://ordr-clients.issou.best"
const socketUrl = "http://localhost:8500"
const io = require("socket.io-client")
const dataProcessor = require('./dataProcessor')
const config = require('../config.json')
const version = 2

exports.startServer = async () => {
    const ioClient = io.connect(socketUrl)

    const {
        clearInterval
    } = require('timers')

    console.log("Server started!")

    setTimeout(() => {
        if (!ioClient.connected) {
            tryReconnection()
            console.log("Cannot connect to the o!rdr server. Trying to connect...")
        }
    }, 2000)


    ioClient.on('connect', () => {
        console.log("Connected to the o!rdr server!")
        ioClient.emit("id", config.id, version, config.usingOsuApi, config.motionBlurCapable)
    })

    ioClient.on('disconnect', () => {
        console.log('We are disconnected from the server! Trying to reconnect...')
        tryReconnection()
    })

    ioClient.on('data', (data) => {
        // console.log(data)
        dataProcessor(data)
    })

    ioClient.on('version_too_old', () => {
        console.log('This version of o!rdr-client is too old! Please update.')
        process.exit()
    })

    function tryReconnection() {
        var reconnectionInterval = setInterval(() => {
            if (ioClient.connected) {
                clearInterval(reconnectionInterval)
            }
            ioClient.connect(socketUrl)
        }, 60000)
    }
}

exports.sendProgression = (data) => {
    const ioClient = io.connect(socketUrl)
    ioClient.emit("progression", {
        id: config.id,
        progress: data
    })
}