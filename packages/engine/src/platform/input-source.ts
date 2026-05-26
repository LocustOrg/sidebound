import type { Vec2 } from '../core/mod.ts'

export type PointerEventFrame = {
    readonly id: number
    readonly position: Vec2
    readonly button: number
}

export type WindowResizeEvent = {
    readonly width: number
    readonly height: number
}

export type InputEvents = {
    readonly quitRequested: boolean
    readonly keysDown: readonly string[]
    readonly keysUp: readonly string[]
    readonly keysHeld: ReadonlySet<string>
    readonly pointerDown: readonly PointerEventFrame[]
    readonly pointerUp: readonly PointerEventFrame[]
    readonly windowResized: WindowResizeEvent | null
}

export type InputSource = {
    poll(): InputEvents
}
