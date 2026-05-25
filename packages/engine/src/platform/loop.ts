import type { AnimationFrameClock } from './clock.ts'

export type EngineFrame = {
    readonly now: number
    readonly deltaSeconds: number
}

export type EngineLoopOptions = {
    readonly clock: AnimationFrameClock
    readonly update: (frame: EngineFrame) => void
    readonly render?: (frame: EngineFrame) => void
    readonly maxDeltaSeconds?: number
}

export class EngineLoop {
    private readonly clock: AnimationFrameClock
    private readonly updateFrame: (frame: EngineFrame) => void
    private readonly renderFrame: ((frame: EngineFrame) => void) | undefined
    private readonly maxDeltaSeconds: number
    private frameId: number | undefined
    private lastFrameTime = 0
    private disposed = false

    constructor(options: EngineLoopOptions) {
        this.clock = options.clock
        this.updateFrame = options.update
        this.renderFrame = options.render
        this.maxDeltaSeconds = options.maxDeltaSeconds ?? 0.25
    }

    get running(): boolean {
        return this.frameId !== undefined
    }

    start(): void {
        if (this.disposed) {
            throw new Error('Cannot start a disposed EngineLoop')
        }

        if (this.frameId !== undefined) {
            return
        }

        this.lastFrameTime = this.clock.now()
        this.frameId = this.clock.requestFrame(this.tick)
    }

    stop(): void {
        if (this.frameId === undefined) {
            return
        }

        this.clock.cancelFrame(this.frameId)
        this.frameId = undefined
    }

    dispose(): void {
        this.stop()
        this.disposed = true
    }

    private readonly tick = (now: number): void => {
        if (this.frameId === undefined) {
            return
        }

        const deltaSeconds = Math.min((now - this.lastFrameTime) / 1000, this.maxDeltaSeconds)
        const frame = { now, deltaSeconds }

        this.lastFrameTime = now
        this.updateFrame(frame)
        this.renderFrame?.(frame)
        this.frameId = this.clock.requestFrame(this.tick)
    }
}
