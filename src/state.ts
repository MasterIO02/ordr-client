type TState = {
    isWorking: boolean
    /**
     * @description is ORV ready to work? we don't need a danserPrepared as it's ALWAYS ready to work
     */
    orvPrepared: boolean
}

export let state: TState = {
    isWorking: false,
    orvPrepared: false
}
