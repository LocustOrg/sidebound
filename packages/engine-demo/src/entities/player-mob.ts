import type { Rect, Vec2 } from '../core/geometry'
import type { SoundCue } from '../systems/audio'
import type { PlayerInputFrame } from '../systems/input'
import { controls } from '../core/config'
import { Mob, type MobPhysics } from './mob'
import { MobState } from './mob-states'
import {
    createPlayerCapeBackOverlaySheet,
    createPlayerCapeFrontOverlaySheet,
    createPlayerSpriteSheet,
    createPlayerSwordOverlaySheet,
    registerPlayerAnimationClips,
} from '../sprites/player-sprites'
import type { SpriteSheet } from '../sprites/sprite-sheet'

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

export type PlayerEquipment = {
    cape: boolean
    sword: boolean
}

/**
 * Player entity — extends Mob with input handling, sound cues, and equipment visuals.
 */
export class PlayerMob extends Mob {
    private stepCooldown = 0
    private readonly capeBackOverlaySheet: SpriteSheet
    private readonly capeFrontOverlaySheet: SpriteSheet
    private readonly swordOverlaySheet: SpriteSheet
    private readonly equipped: PlayerEquipment = {
        cape: false,
        sword: false,
    }

    constructor(spawn: Vec2, solids: Rect[]) {
        const sheet = createPlayerSpriteSheet()

        super({
            spawn,
            width: 8,
            height: 28,
            spriteSheet: sheet,
            physics: PLAYER_PHYSICS,
            solids,
            // Sprite is 32x32, collision box is 8x28 — offset aligns sprite feet with hitbox bottom.
            spriteOffsetX: -13,
            spriteOffsetY: -3,
        })

        registerPlayerAnimationClips(this.animator)
        this.capeBackOverlaySheet = createPlayerCapeBackOverlaySheet()
        this.capeFrontOverlaySheet = createPlayerCapeFrontOverlaySheet()
        this.swordOverlaySheet = createPlayerSwordOverlaySheet()
    }

    /**
     * Runs one frame of player logic. Returns sound cues to play.
     */
    update(deltaSeconds: number, input: PlayerInputFrame): SoundCue[] {
        const cues: SoundCue[] = []
        const previousState = this.mobState

        this.updatePhysics(deltaSeconds, input.horizontal, input.jumpQueued, input.jumpHeld, input.downHeld)

        // Respawn if player falls out of world bounds
        if (this.y < -200 || this.x < -200) {
            this.respawn()
        }

        this.animator.playbackRate = this.resolvePlaybackRate(input.horizontal)
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

    getEquipment(): PlayerEquipment {
        return { ...this.equipped }
    }

    setEquipment(equipment: Partial<PlayerEquipment>): void {
        this.equipped.cape = equipment.cape ?? this.equipped.cape
        this.equipped.sword = equipment.sword ?? this.equipped.sword
    }

    equipCape(): void {
        this.equipped.cape = true
    }

    equipSword(): void {
        this.equipped.sword = true
    }

    /** Draws optional visual equipment without changing collision or movement. */
    override draw(context: CanvasRenderingContext2D): void {
        const drawX = Math.round(this.x + this.spriteOffsetX)
        const drawY = Math.round(this.y + this.spriteOffsetY)
        const flipX = this.facing < 0
        const frame = this.animator.currentFrame

        if (this.equipped.cape) {
            this.capeBackOverlaySheet.drawFrame(context, frame, drawX, drawY, flipX)
        }

        super.draw(context)

        if (this.equipped.sword) {
            this.swordOverlaySheet.drawFrame(context, frame, drawX, drawY, flipX)
        }

        if (this.equipped.cape) {
            this.capeFrontOverlaySheet.drawFrame(context, frame, drawX, drawY, flipX)
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

    private resolvePlaybackRate(horizontal: number): number {
        const speedRatio = Math.min(1, Math.abs(this.vx) / Math.max(1, PLAYER_PHYSICS.maxSpeed))

        switch (this.mobState) {
            case MobState.Running:
                return 0.92 + speedRatio * 0.8
            case MobState.Stopping:
                return 1.05
            case MobState.Jumping:
                return 0.94 + Math.abs(horizontal) * 0.08
            case MobState.Falling:
                return 0.9
            case MobState.Landing:
                return 1.12
            default:
                return 0.98
        }
    }
}






