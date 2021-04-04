module.exports = uploadVideo = async (videoName) => {
    const {
        sendProgression
    } = require("./server")
    const config = require('../config.json')
    const fs = require('fs')
    const axios = require('axios')
    const FormData = require('form-data')

    const formData = new FormData()
    formData.append("videoFile", fs.createReadStream(`${config.videosPath}/${videoName}.mp4`))
    formData.append("rendererId", config.id)

    console.log("Uploading video.")

    await axios.post('https://ordr-api.issou.best/upload', formData, {
        headers: formData.getHeaders(),
        maxBodyLength: Infinity
    }).then(() => {
        sendProgression("Done.")
        console.log("Video sent succesfully. Waiting for a new task.")
    }).catch((error) => {
        console.log(error.message)
    })








    // this was the implementation of hyperbeam that would have been really nice if node discovery wouldn't take 5 minutes...
    // When it'll get faster this will maybe be the way videos will get uploaded.
    // For now, videos get uploaded directly to the server via the API.

    /*const Hyperbeam = require('hyperbeam')
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

    sendProgression("Done.")*/
}