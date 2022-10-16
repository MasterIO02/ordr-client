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
            largeImageText: `Avg render time: ${clientInfos.data.avgRenderTime}s/min\nAvg upload time: ${clientInfos.data.avgUploadTime}s/min`
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
        largeImageText: `Avg render time: ${clientInfos.data.avgRenderTime}s/min\nAvg upload time: ${clientInfos.data.avgUploadTime}s/min`
    })
}
