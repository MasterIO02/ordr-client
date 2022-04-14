exports.exit = () => {
    console.log("Press any key to exit.")
    process.stdin.setRawMode(true)
    process.stdin.on("data", process.exit.bind(process, 0))
}
