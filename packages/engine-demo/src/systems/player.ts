import type { SoundCue } from './audio'
import { controls } from '../core/config'
import { approach, rectsIntersect, type Rect, type Vec2 } from '../core/geometry'
import type { PlayerInputFrame } from './input'

export type PlayerState = {
    x: number
    y: number
    width: number
    height: number
    vx: number
    vy: number
    grounded: boolean
    facing: number
    lightRadius: number
}

const jumpCue: SoundCue = {
    frequency: 246,
    durationSeconds: 0.09,
    gain: 0.04,
}

const landCue: SoundCue = {
    frequency: 118,
    durationSeconds: 0.08,
    gain: 0.03,
}

export function getLightOrigin(player: PlayerState): Vec2 {
    return {
        x: player.x + player.width / 2 + player.facing * 2,
        y: player.y + 6,
    }
}

export function getPlayerRect(player: PlayerState): Rect {
    return {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height,
    }
}

function createPlayerState(spawn: Vec2): PlayerState {
    return {
        x: spawn.x,
        y: spawn.y,
        width: 5,
        height: 10,
        vx: 0,
        vy: 0,
        grounded: false,
        facing: 1,
        lightRadius: 88,
    }
}

function createStepCue(vx: number): SoundCue {
    return {
        frequency: 76 + Math.round(Math.abs(vx) % 20),
        durationSeconds: 0.04,
        gain: 0.016,
    }
}

export class PlayerController {
    readonly state: PlayerState
    private readonly solids: Rect[]
    private stepCooldown = 0

    constructor(spawn: Vec2, solids: Rect[]) {
        this.state = createPlayerState(spawn)
        this.solids = solids
    }

    update(deltaSeconds: number, input: PlayerInputFrame): SoundCue[] {
        const cues: SoundCue[] = []
        const acceleration = this.state.grounded ? controls.groundAcceleration : controls.airAcceleration
        const targetVx = input.horizontal * controls.maxSpeed

        if (input.horizontal !== 0) {
            this.state.facing = input.horizontal
            this.state.vx = approach(this.state.vx, targetVx, acceleration * deltaSeconds)
        } else if (this.state.grounded) {
            this.state.vx = approach(this.state.vx, 0, controls.friction * deltaSeconds)
        } else {
            this.state.vx = approach(this.state.vx, 0, controls.airAcceleration * 0.18 * deltaSeconds)
        }

        if (input.jumpQueued && this.state.grounded) {
            this.state.vy = -controls.jumpVelocity
            this.state.grounded = false
            cues.push(jumpCue)
        }

        this.state.vy += controls.gravity * deltaSeconds

        const previousGrounded = this.state.grounded

        this.moveHorizontal(this.state.vx * deltaSeconds)
        this.moveVertical(this.state.vy * deltaSeconds)
        this.addMovementSoundCues(cues, deltaSeconds, input.horizontal, previousGrounded)

        return cues
    }

    private moveHorizontal(distance: number): void {
        this.state.x += distance

        for (const solid of this.solids) {
            if (!rectsIntersect(getPlayerRect(this.state), solid)) {
                continue
            }

            if (distance > 0) {
                this.state.x = solid.x - this.state.width
            } else if (distance < 0) {
                this.state.x = solid.x + solid.width
            }

            this.state.vx = 0
        }
    }

    private moveVertical(distance: number): void {
        this.state.y += distance
        this.state.grounded = false

        for (const solid of this.solids) {
            if (!rectsIntersect(getPlayerRect(this.state), solid)) {
                continue
            }

            if (distance > 0) {
                this.state.y = solid.y - this.state.height
                this.state.grounded = true
            } else if (distance < 0) {
                this.state.y = solid.y + solid.height
            }

            this.state.vy = 0
        }
    }

    private addMovementSoundCues(cues: SoundCue[], deltaSeconds: number, horizontal: number, previousGrounded: boolean): void {
        if (this.state.grounded && !previousGrounded) {
            cues.push(landCue)
        }

        if (!this.state.grounded || horizontal === 0 || Math.abs(this.state.vx) < 12) {
            this.stepCooldown = 0
            return
        }

        this.stepCooldown -= deltaSeconds

        if (this.stepCooldown <= 0) {
            cues.push(createStepCue(this.state.vx))
            this.stepCooldown = 0.16
        }
    }
}
