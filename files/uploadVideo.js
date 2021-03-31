module.exports = uploadVideo = async (videoName) => {
    const {
        nanoid
    } = require("nanoid")
    const {
        sendProgression
    } = require("./server")
    const config = require('../config.json')
    const fs = require('fs')
    const Hyperbeam = require('hyperbeam')
    var beamPass = nanoid()
    // console.log(beamPass)
    const beam = new Hyperbeam(beamPass)

    console.log("Uploading video.")

    fs.createReadStream(`${config.videosPath}/${videoName}.mp4`).pipe(beam)
    beam.on('remote-address', ({
        host,
        port
    }) => {
        if (!host) console.error('[hyperbeam] Could not detect remote address')
        else console.error('[hyperbeam] Joined the DHT - remote address is ' + host + ':' + port)
        if (port) console.error('[hyperbeam] Network is holepunchable \\o/')
        sendProgression(`hyperbeam:${beamPass}`)
    })
    beam.on('connected', () => {
        console.error('[hyperbeam] Success! Encrypted tunnel established to remote peer')
    })
    beam.on('end', () => {
        console.log('[hyperbeam] File sent successfully.')
        console.log("Waiting for a new task.")
    })

    sendProgression("Done.")
}