// TODO: test everywhere that state works

type TState = {
    job: "NONE" | "DANSER_FULL_VIDEO"
    isWorking: boolean
}

export let state: TState = {
    job: "NONE",
    isWorking: false
}
