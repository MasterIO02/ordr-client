module.exports = async videoName => {
    const { sendProgression } = require("./server")
    const config = require(process.cwd() + "/config.json")
    const fs = require("fs")
    const axios = require("axios")
    const FormData = require("form-data")
    const { isRendering } = require("./danserHandler")

    var uploadUrl
    if (config.customServer && config.customServer.apiUrl !== "") {
        uploadUrl = config.customServer.apiUrl + "/upload"
    } else {
        uploadUrl = "https://ordr-api.issou.best/upload"
    }

    const formData = new FormData()
    formData.append("rendererId", config.id)
    formData.append("videoFile", fs.createReadStream(`${process.cwd()}/files/danser/videos/${videoName}.mp4`))

    console.log("Uploading video.")

    await axios
        .post(uploadUrl, formData, {
            headers: formData.getHeaders(),
            maxBodyLength: Infinity
        })
        .then(() => {
            if (config.deleteRenderedVideos) {
                fs.unlinkSync(`${process.cwd()}/files/danser/videos/${videoName}.mp4`)
            }
            sendProgression("Done.")
            console.log("Video sent succesfully. Waiting for a new task.")
            isRendering(false)
        })
        .catch(error => {
            console.log(error.message)
            sendProgression("failed_upload")
            isRendering(false)
        })
}
