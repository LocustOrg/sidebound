/**
 * Converts raw InputEvents (key state) into a PlayerInputFrame.
 * Used by both browser and SDL runtimes to feed the same player controller.
 */

import type { InputEvents } from '../platform/input-source.ts'
import type { PlayerInputFrame } from './input-manager.ts'

const defaultJumpKeys = new Set(['arrowup', 'w', ' '])

export type InputFrameReducerOptions = {
    readonly jumpKeys?: ReadonlySet<string>
}

/**
 * Stateless reducer: given the current input events snapshot, produce
 * the player action frame. Jump is "queued" if any jump key appeared in
 * keysDown this frame.
 */
export function reduceInputFrame(events: InputEvents, options?: InputFrameReducerOptions): PlayerInputFrame {
    const jumpKeys = options?.jumpKeys ?? defaultJumpKeys

    const horizontal = Number(events.keysHeld.has('arrowright') || events.keysHeld.has('d')) -
        Number(events.keysHeld.has('arrowleft') || events.keysHeld.has('a'))

    const jumpQueued = events.keysDown.some((key) => jumpKeys.has(key))

    const jumpHeld = events.keysHeld.has('arrowup') || events.keysHeld.has('w') || events.keysHeld.has(' ')

    const downHeld = events.keysHeld.has('arrowdown') || events.keysHeld.has('s')

    return { horizontal, jumpQueued, jumpHeld, downHeld }
}
