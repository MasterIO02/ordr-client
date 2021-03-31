const config = require('./config.json')
const firstLaunch = require('./files/firstLaunch')
const startServer = require('./files/server').startServer

if (config.id) {
    startServer()
} else {
    firstLaunch()
}