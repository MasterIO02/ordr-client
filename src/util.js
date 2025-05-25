const fs = require("fs")

exports.readConfig = async () => {
    if (!fs.existsSync(process.cwd() + "/config.json")) {
        fs.writeFileSync(process.cwd() + "/config.json", JSON.stringify(emptyConfig, null, 2), { encoding: "utf-8" })
    }

    return JSON.parse(fs.readFileSync(process.cwd() + "/config.json", { encoding: "utf-8" }))
}

exports.writeConfig = async (key, value) => {
    if (!fs.existsSync(process.cwd() + "/config.json")) {
        fs.writeFileSync(process.cwd() + "/config.json", JSON.stringify(emptyConfig, null, 2), { encoding: "utf-8" })
    }

    let config = JSON.parse(fs.readFileSync(process.cwd() + "/config.json", { encoding: "utf-8" }))
    config[key] = value
    fs.writeFileSync(process.cwd() + "/config.json", JSON.stringify(config, null, 2), { encoding: "utf-8" })
    return config
}
