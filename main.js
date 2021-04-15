const config = require('./config.json')
const firstLaunch = require('./files/firstLaunch')
const checkDanserVersion = require('./files/checkDanserVersion')

if (config.id) {
    checkDanserVersion()
} else {
    firstLaunch()
}