/**
 * Movement states shared by all Mob-like entities (players, NPCs, enemies).
 * Each state drives animation selection and can affect physics behavior.
 */
export const MobState = {
    Idle: 'idle',
    Running: 'running',
    Stopping: 'stopping',
    Jumping: 'jumping',
    Falling: 'falling',
    Landing: 'landing',
} as const

export type MobState = (typeof MobState)[keyof typeof MobState]

/**
 * Determines the next MobState based on physics signals.
 * Pure function — no side effects.
 */
export function resolveMobState(
    current: MobState,
    grounded: boolean,
    velocityX: number,
    velocityY: number,
    inputHorizontal: number,
    justLanded: boolean,
    justJumped: boolean,
    stoppingThreshold: number,
): MobState {
    // Air states take priority
    if (justJumped) return MobState.Jumping
    if (!grounded && velocityY > 0) return MobState.Falling
    if (!grounded && velocityY <= 0) return MobState.Jumping

    // Just touched ground
    if (justLanded) return MobState.Landing

    // Ground states
    if (current === MobState.Landing) {
        // Stay in landing until externally transitioned (animation finish)
        return MobState.Landing
    }

    if (inputHorizontal !== 0) return MobState.Running

    if (Math.abs(velocityX) > stoppingThreshold) return MobState.Stopping

    return MobState.Idle
}


