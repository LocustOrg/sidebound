import type { AnimationFrameClock } from '@sidebound/engine'

export class BrowserAnimationFrameClock implements AnimationFrameClock {
    now(): number {
        return performance.now()
    }

    requestFrame(callback: (now: number) => void): number {
        return requestAnimationFrame(callback)
    }

    cancelFrame(frameId: number): void {
        cancelAnimationFrame(frameId)
    }
}
