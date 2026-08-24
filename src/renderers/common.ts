import fs from "fs"

// TODO: all fs calls to fs/promises

/**
 * @description Prepare common assets for all renderers at client startup and for every incoming job
 */
export async function prepareCommonAssets(): Promise<boolean> {
    // checking for custom folder paths at every run to make sure they're all there (user could have deleted something)
    if (!fs.existsSync("data/songs")) fs.mkdirSync("data/songs", { recursive: true })
    if (!fs.existsSync("data/skins")) fs.mkdirSync("data/skins", { recursive: true })
    if (!fs.existsSync("data/replays")) fs.mkdirSync("data/replays", { recursive: true })
    if (!fs.existsSync("data/videos")) fs.mkdirSync("data/videos", { recursive: true })
    if (!fs.existsSync("data/screenshots")) fs.mkdirSync("data/screenshots", { recursive: true })

    return true
}

export function buildSkinFolderName(skinId: number, skinVersion: number, skinMinorVersion: number) {
    const skinMajor = skinVersion || 0
    const skinMinor = skinMinorVersion || 0
    const versionSuffix = skinMajor > 0 ? `_v${skinMajor}.${skinMinor}` : ""
    return `CUSTOM_${skinId}${versionSuffix}`
}
