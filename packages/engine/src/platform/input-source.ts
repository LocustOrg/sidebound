import type { Vec2 } from '../core'

export type PointerEventFrame = {
    readonly id: number
    readonly position: Vec2
    readonly button: number
}

export type InputEvents = {
    readonly quitRequested: boolean
    readonly keysDown: readonly string[]
    readonly keysUp: readonly string[]
    readonly keysHeld: ReadonlySet<string>
    readonly pointerDown: readonly PointerEventFrame[]
    readonly pointerUp: readonly PointerEventFrame[]
}

export type InputSource = {
    poll(): InputEvents
}
