import si from "systeminformation"
import cleanExit from "./clean_exit"

export interface IHardwareInfo {
    cpu: string
    gpu: string
}

let cachedHardware: IHardwareInfo | null = null

/**
 * @description Get the CPU and GPU models of this machine and cache the result, exit if they cannot be read.
 */
export async function getHardwareInfo(): Promise<IHardwareInfo> {
    if (cachedHardware) return cachedHardware

    try {
        const [cpuData, gpuData] = await Promise.all([si.cpu(), si.graphics()])
        cachedHardware = {
            cpu: `${cpuData.manufacturer} ${cpuData.brand} ${cpuData.speed} ${cpuData.cores}`,
            gpu: gpuData.controllers.map(g => `${g.vendor} ${g.model}`).join(";")
        }
        return cachedHardware
    } catch (err) {
        console.error("Could not read the CPU/GPU information, cannot continue.", err)
        await cleanExit()
        throw err // cleanExit exits the process, this line only exists to satisfy TypeScript
    }
}

/**
 * @description Check if at least one display is connected.
 */
export async function hasDisplayConnected(): Promise<boolean> {
    let gpuData = await si.graphics()
    return gpuData.displays.length > 0
}
