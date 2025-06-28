import { RP } from "discord-rich-presence"
import { z } from "zod"
import { getKeys } from "./keys"
import { config } from "./config"

let rpClient: RP
const startTimestamp = new Date()

let clientInfo: TClientInfo = { totalRenderedVideos: 0, avgRenderTime: 0, avgUploadTime: 0, score: 0, totalUploadedVideosSize: 0 }

export async function startDiscordPresence() {
    const richPresence = (await import("discord-rich-presence")).default
    rpClient = richPresence("992054622732689498")

    rpClient.on("connected", async () => {
        console.log("Connected to Discord.")

        let newClientInfo = await fetchClientInfo()
        if (newClientInfo) clientInfo = newClientInfo

        rpClient.updatePresence({
            startTimestamp,
            state: "Idle",
            details: `${clientInfo.totalRenderedVideos} rendered videos, ${clientInfo.score.toFixed(1)} score`,
            largeImageKey: "ordr-logo",
            largeImageText: `Avg render time: ${clientInfo.avgRenderTime}s/min\nAvg upload time: ${clientInfo.avgUploadTime}s/min`
        })
    })
}

export async function updateDiscordPresence(status: "Working" | "Idle", addVideo: boolean) {
    if (!rpClient) return

    if (addVideo) clientInfo.totalRenderedVideos++

    // update client info every 10 videos
    if (clientInfo.totalRenderedVideos % 10 === 0) {
        let newClientInfo = await fetchClientInfo()
        if (newClientInfo) clientInfo = newClientInfo
    }

    rpClient.updatePresence({
        startTimestamp,
        state: status,
        details: `${clientInfo.totalRenderedVideos} rendered videos, ${clientInfo.score.toFixed(1)} score`,
        largeImageKey: "ordr-logo",
        largeImageText: `Avg render time: ${clientInfo.avgRenderTime}s/min\nAvg upload time: ${clientInfo.avgUploadTime}s/min`
    })
}

const ClientInfoSchema = z.object({
    totalRenderedVideos: z.number().int(),
    avgRenderTime: z.number(),
    avgUploadTime: z.number(),
    score: z.number(),
    totalUploadedVideosSize: z.number().int()
})

type TClientInfo = z.infer<typeof ClientInfoSchema>

async function fetchClientInfo(): Promise<TClientInfo | null> {
    let keys = await getKeys()
    if (!keys) return null

    let clientInfoUrl = config.dev ? `${config.dev?.server.api}/ordr/servers/privateclientinfo?id=${keys.client_id}` : `https://apis.issou.best/ordr/servers/privateclientinfo?id=${keys.client_id}`
    try {
        const response = await fetch(clientInfoUrl)

        if (!response.ok) {
            console.error(`Bad response from the o!rdr server while trying to fetch client info (code ${response.status}).`, response)
        }

        const rawData = await response.json()
        let parsed = ClientInfoSchema.parse(rawData)
        return parsed
    } catch (err) {
        console.error("An error occured while trying to fetch client info", err)
        return null
    }
}
