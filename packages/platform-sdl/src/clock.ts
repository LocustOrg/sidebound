/**
 * SDL clock implementation using Deno performance timers.
 */

import type { EngineClock } from '@sidebound/engine'

export class SdlClock implements EngineClock {
    now(): number {
        return performance.now()
    }

    sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }
}
