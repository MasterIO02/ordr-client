import { z } from "zod"
import { config } from "./config"

const StartupDataSchema = z.object({
    validateFiles: z.array(
        z.object({
            linux: z.string().optional(),
            windows: z.string().optional(),
            for: z.enum(["danser"]),
            path: z.string()
        })
    ),
    danserVersion: z.string(),
    minimumClientVersion: z.number().int(),
    maximumClientVersion: z.number().int()
})

export type TFileToValidate = z.infer<typeof StartupDataSchema.shape.validateFiles.element>

export type TRenderer = z.infer<typeof StartupDataSchema.shape.validateFiles.element.shape.for>

export type TStartupData = z.infer<typeof StartupDataSchema>

/**
 * @description Fetch the initial startup data, used to check renderer integrity and accepted client versions
 */
export default async function fetchStartupData(): Promise<TStartupData> {
    try {
        const response = await fetch((config.dev?.server.api || "https://apis.issou.best/ordr") + "/servers/version")

        if (!response.ok) {
            console.error(`Bad response from the o!rdr server while trying to fetch initial client data (code ${response.status}).`, response)
            process.exit(1)
        }

        const rawData = await response.json()
        let parsed = StartupDataSchema.parse(rawData)
        return parsed
    } catch (err) {
        console.error("An error occured while trying to fetch initial client data.", err)
        process.exit(1)
    }
}
