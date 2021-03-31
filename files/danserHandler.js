const uploadVideo = require('./uploadVideo')
const {
    sendProgression
} = require('./server')

module.exports = danserHandler = async (arguments, videoName) => {
    const config = require('../config.json')
    var spawn = require('child_process').spawn
    const danser = spawn(config.danserPath, arguments)

    danser.stdout.setEncoding('utf8')
    danser.stdout.on(`data`, (data) => {
        if (data.includes('Progress')) {
            console.log(data)
            sendProgression(data)
        }
        if (data.includes('Finished.')) {
            console.log(`Rendering done.`)
            uploadVideo(videoName)
        }
        if (data.includes('Ran using:')) {
            console.log(data)
        }
        if (data.includes('Beatmap not found')) {
            sendProgression('beatmap_not_found')
            console.log("Cannot process replay. This is not a Danser problem, waiting for another job.")
        }
        if (data.includes('panic')) {
            sendProgression('panic')
            console.log(data)
            console.log("An error occured. Waiting for another job.")
        }
    })
    danser.stderr.setEncoding('utf8')
    danser.stderr.on('data', (data) => {
        if (data.includes('bitrate') && data.includes('frame')) {
            console.log(data)
        }
    })
}