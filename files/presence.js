const { default: axios } = require("axios")
const config = require("../config.json")
let rpClient
if (config.discordPresence) {
    rpClient = require("discord-rich-presence")("992054622732689498")
}

const privateClientInfoUrl = `https://apis.issou.best/ordr/servers/privateclientinfo?id=${config.id}`
let startTimestamp = new Date()
let clientInfos
let totalRenderedVideos = 0

exports.startPresence = async () => {
    rpClient.on("connected", async () => {
        console.log("Connected to Discord.")

        clientInfos = await axios.get(privateClientInfoUrl)
        totalRenderedVideos = clientInfos.data.totalRenderedVideos

        rpClient.updatePresence({
            startTimestamp,
            state: "Idle",
            details: `${totalRenderedVideos} rendered videos, ${clientInfos.data.score.toFixed(1)} score`,
            largeImageKey: "ordr-logo",
            largeImageText: `Average render time: ${msToReadableTime(clientInfos.data.avgRenderTime)}\nAverage upload time: ${msToReadableTime(clientInfos.data.avgUploadTime)}`
        })
    })
}

exports.updatePresence = async (status, addVideo) => {
    if (addVideo) totalRenderedVideos++

    if (totalRenderedVideos % 10 === 0) {
        clientInfos = await axios.get(privateClientInfoUrl)
    }

    rpClient.updatePresence({
        startTimestamp,
        state: status,
        details: `${totalRenderedVideos} rendered videos, ${clientInfos.data.score.toFixed(1)} score`,
        largeImageKey: "ordr-logo",
        largeImageText: `Average render time: ${msToReadableTime(clientInfos.data.avgRenderTime)} min\nAverage upload time: ${msToReadableTime(clientInfos.data.avgUploadTime)} min`
    })
}

function msToReadableTime(millis) {
    var minutes = Math.floor(millis / 60000)
    var seconds = ((millis % 60000) / 1000).toFixed(0)
    return seconds == 60 ? minutes + 1 + ":00" : minutes + ":" + (seconds < 10 ? "0" : "") + seconds
}
