import type { Rect, Vec2 } from '../core/geometry'
import type { SoundCue } from '../systems/audio'
import type { PlayerInputFrame } from '../systems/input'
import { controls } from '../core/config'
import { Mob, type MobPhysics } from './mob'
import { MobState } from './mob-states'
import { createPlayerSpriteSheet } from '../sprites/player-sprites'
import type { AnimationClip } from '../sprites/animator'

const PLAYER_PHYSICS: MobPhysics = {
    maxSpeed: controls.maxSpeed,
    groundAcceleration: controls.groundAcceleration,
    airAcceleration: controls.airAcceleration,
    friction: controls.friction,
    gravity: controls.gravity,
    jumpVelocity: controls.jumpVelocity,
    stoppingThreshold: 8,
}

const jumpCue: SoundCue = { frequency: 246, durationSeconds: 0.09, gain: 0.04 }
const landCue: SoundCue = { frequency: 118, durationSeconds: 0.08, gain: 0.03 }

function createStepCue(vx: number): SoundCue {
    return { frequency: 76 + Math.round(Math.abs(vx) % 20), durationSeconds: 0.04, gain: 0.016 }
}

/**
 * Player entity — extends Mob with input handling, sound cues, and light source.
 */
export class PlayerMob extends Mob {
    lightRadius = 88
    private stepCooldown = 0

    constructor(spawn: Vec2, solids: Rect[]) {
        const sheet = createPlayerSpriteSheet()
        super({
            spawn,
            width: 5,
            height: 10,
            spriteSheet: sheet,
            physics: PLAYER_PHYSICS,
            solids,
            // Sprite is 16x20, collision box is 5x10 → offset to align feet with hitbox bottom
            spriteOffsetX: -5,
            spriteOffsetY: -7,
        })

        // Register animation clips
        const clips: AnimationClip[] = [
            { name: 'idle', frames: [0, 1, 2, 3], frameDuration: 0.22, loop: true },
            { name: 'run', frames: [8, 9, 10, 11, 12, 13], frameDuration: 0.09, loop: true },
            { name: 'jump', frames: [16, 17], frameDuration: 0.14, loop: false },
            { name: 'fall', frames: [24, 25], frameDuration: 0.16, loop: true },
            { name: 'land', frames: [32, 33, 34], frameDuration: 0.06, loop: false },
            { name: 'stop', frames: [34, 33, 32], frameDuration: 0.07, loop: false },
        ]

        for (const clip of clips) {
            this.animator.addClip(clip)
        }

        this.animator.play('idle')
    }

    /**
     * Runs one frame of player logic. Returns sound cues to play.
     */
    update(deltaSeconds: number, input: PlayerInputFrame): SoundCue[] {
        const cues: SoundCue[] = []
        const previousState = this.mobState

        this.updatePhysics(deltaSeconds, input.horizontal, input.jumpQueued)
        this.updateAnimation(deltaSeconds)

        // Sound cues
        if (this.mobState === MobState.Jumping && previousState !== MobState.Jumping) {
            cues.push(jumpCue)
        }

        if (this.mobState === MobState.Landing && previousState !== MobState.Landing) {
            cues.push(landCue)
        }

        this.addStepCues(cues, deltaSeconds, input.horizontal)

        return cues
    }

    /** Light source origin (slightly ahead of facing) */
    getLightOrigin(): Vec2 {
        return {
            x: this.x + this.width / 2 + this.facing * 2,
            y: this.y + 6,
        }
    }

    private addStepCues(cues: SoundCue[], deltaSeconds: number, horizontal: number): void {
        if (!this.grounded || horizontal === 0 || Math.abs(this.vx) < 12) {
            this.stepCooldown = 0
            return
        }

        this.stepCooldown -= deltaSeconds
        if (this.stepCooldown <= 0) {
            cues.push(createStepCue(this.vx))
            this.stepCooldown = 0.16
        }
    }
}






