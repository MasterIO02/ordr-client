// this is a typescript-adapted version of https://github.com/bahamas10/node-log-prefix/blob/master/log-prefix.js + log-timestamp

import util from "util"

type ConsoleMethod = (...args: unknown[]) => void

const funcs: Record<"log" | "info" | "warn" | "error" | "debug", ConsoleMethod> = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: (console.debug ? console.debug : console.log).bind(console)
}

export default function injectTimestamp(): void {
    ;(Object.keys(funcs) as Array<keyof typeof funcs>).forEach(k => {
        console[k] = function (...args: unknown[]) {
            const s = typeof getTimestamp === "function" ? getTimestamp() : getTimestamp
            args[0] = util.format(s, args[0])
            funcs[k](...args)
        }
    })
}

function getTimestamp(): string {
    const now = new Date()
    const pad = (n: number) => (n < 10 ? "0" + n : n)
    return `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}]`
}
