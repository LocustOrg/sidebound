import type { Rect, Renderer2D, Vec2 } from '@sidebound/engine'
import { approach, rectsIntersect } from '@sidebound/engine'
import { Animator, type SpriteSheet } from '@sidebound/engine'
import { MobState, resolveMobState } from './mob-states.ts'

/**
 * Physics configuration for a Mob.
 * Subclasses or instances can provide different values for different entity types.
 */
export type MobPhysics = {
    maxSpeed: number
    groundAcceleration: number
    airAcceleration: number
    friction: number
    gravity: number
    jumpVelocity: number
    /** Below this vx the mob transitions from 'stopping' to 'idle' */
    stoppingThreshold: number
}

/**
 * Animation mapping: maps MobState → clip name in the Animator.
 * Override per-entity to support different sprite sets.
 */
export type MobAnimationMap = Record<MobState, string>

export type MobShadowProjection = {
    x: number
    y: number
    distance: number
}

const DEFAULT_ANIMATION_MAP: MobAnimationMap = {
    [MobState.Idle]: 'idle',
    [MobState.Running]: 'run',
    [MobState.Stopping]: 'stop',
    [MobState.Jumping]: 'jump',
    [MobState.Falling]: 'fall',
    [MobState.Landing]: 'land',
}

/**
 * Base Mob class.
 * Handles physics, collision, state machine, and sprite animation.
 * Extend this for players, NPCs, and enemies.
 */
export class Mob {
    // Position & size
    x: number
    y: number
    width: number
    height: number

    // Spawn point for respawn
    readonly spawnPoint: Vec2

    // Velocity
    vx = 0
    vy = 0

    // State
    grounded = false
    facing = 1
    mobState: MobState = MobState.Idle
    noClip = false

    // Sprite offset from collision box (for centering larger sprites)
    spriteOffsetX: number
    spriteOffsetY: number

    // Systems
    readonly animator: Animator
    protected readonly physics: MobPhysics
    protected readonly animationMap: MobAnimationMap
    protected readonly solids: Rect[]

    constructor(options: {
        spawn: Vec2
        width: number
        height: number
        spriteSheet: SpriteSheet
        physics: MobPhysics
        solids: Rect[]
        animationMap?: MobAnimationMap
        spriteOffsetX?: number
        spriteOffsetY?: number
    }) {
        this.width = options.width
        this.height = options.height

        this.x = options.spawn.x
        this.y = options.spawn.y - this.height
        this.spawnPoint = { x: this.x, y: this.y }

        this.physics = options.physics
        this.solids = options.solids
        this.animationMap = options.animationMap ?? DEFAULT_ANIMATION_MAP
        this.animator = new Animator(options.spriteSheet)
        this.spriteOffsetX = options.spriteOffsetX ?? 0
        this.spriteOffsetY = options.spriteOffsetY ?? 0
    }

    /** The collision rect of this mob */
    getRect(): Rect {
        return { x: this.x, y: this.y, width: this.width, height: this.height }
    }

    /** Center position */
    getCenter(): Vec2 {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 }
    }

    /** Reset mob to spawn point */
    respawn(): void {
        this.x = this.spawnPoint.x
        this.y = this.spawnPoint.y
        this.vx = 0
        this.vy = 0
        this.grounded = false
        this.mobState = MobState.Falling
    }

    /** Ground point directly below this mob, used for rendering projected shadows. */
    getShadowProjection(): MobShadowProjection | null {
        const footY = this.y + this.height
        let groundY = Number.POSITIVE_INFINITY

        for (const solid of this.solids) {
            const overlapsFootprint = this.x < solid.x + solid.width && this.x + this.width > solid.x
            if (!overlapsFootprint || solid.y < footY - 0.5) continue

            groundY = Math.min(groundY, solid.y)
        }

        if (!Number.isFinite(groundY)) {
            return null
        }

        return {
            x: this.x + this.width / 2,
            y: groundY,
            distance: Math.max(0, groundY - footY),
        }
    }

    /**
     * Core physics + state update. Call from subclass update().
     * `inputHorizontal`: -1, 0, or 1
     * `jumpRequested`: whether a jump was requested this frame
     * `jumpHeld`: whether jump key is currently held (for no-clip flight up)
     * `downHeld`: whether down key is currently held (for no-clip flight down)
     */
    updatePhysics(deltaSeconds: number, inputHorizontal: number, jumpRequested: boolean, jumpHeld = false, downHeld = false): void {
        // No-clip mode: free flight, no gravity, no collision
        if (this.noClip) {
            const noclipSpeed = this.physics.maxSpeed * 2.5
            this.vx = inputHorizontal * noclipSpeed

            if (jumpHeld && !downHeld) {
                this.vy = -noclipSpeed
            } else if (downHeld && !jumpHeld) {
                this.vy = noclipSpeed
            } else {
                this.vy = 0
            }

            this.x += this.vx * deltaSeconds
            this.y += this.vy * deltaSeconds
            this.grounded = false
            return
        }

        const wasGrounded = this.grounded
        let justJumped = false

        // Horizontal movement
        const acceleration = this.grounded ? this.physics.groundAcceleration : this.physics.airAcceleration
        const targetVx = inputHorizontal * this.physics.maxSpeed

        if (inputHorizontal !== 0) {
            this.facing = inputHorizontal
            this.vx = approach(this.vx, targetVx, acceleration * deltaSeconds)
        } else if (this.grounded) {
            this.vx = approach(this.vx, 0, this.physics.friction * deltaSeconds)
        } else {
            this.vx = approach(this.vx, 0, this.physics.airAcceleration * 0.18 * deltaSeconds)
        }

        // Jump
        if (jumpRequested && this.grounded) {
            this.vy = -this.physics.jumpVelocity
            this.grounded = false
            justJumped = true
        }

        // Gravity
        this.vy += this.physics.gravity * deltaSeconds

        // Move & collide
        this.moveHorizontal(this.vx * deltaSeconds)
        this.moveVertical(this.vy * deltaSeconds)

        const justLanded = this.grounded && !wasGrounded

        // Resolve state
        const nextState = resolveMobState(
            this.mobState,
            this.grounded,
            this.vx,
            this.vy,
            inputHorizontal,
            justLanded,
            justJumped,
            this.physics.stoppingThreshold,
        )

        this.transitionState(nextState)
    }

    /** Update the animation each frame */
    updateAnimation(deltaSeconds: number): void {
        // If landing/stop animation finished, go to idle
        if (this.animator.finished) {
            if (this.mobState === MobState.Landing || this.mobState === MobState.Stopping) {
                this.transitionState(MobState.Idle)
            }
        }

        this.animator.update(deltaSeconds)
    }

    /** Draw the mob's current sprite frame */
    draw(renderer: Renderer2D): void {
        const drawX = Math.round(this.x + this.spriteOffsetX)
        const drawY = Math.round(this.y + this.spriteOffsetY)
        const flipX = this.facing < 0
        this.animator.draw(renderer, drawX, drawY, flipX)
    }

    protected transitionState(next: MobState): void {
        if (next === this.mobState) return
        this.mobState = next
        const clipName = this.animationMap[next]
        if (clipName) {
            this.animator.play(clipName)
        }
    }

    private moveHorizontal(distance: number): void {
        this.x += distance

        const rect = this.getRect()
        for (const solid of this.solids) {
            if (!rectsIntersect(rect, solid)) continue

            if (distance > 0) {
                this.x = solid.x - this.width
            } else if (distance < 0) {
                this.x = solid.x + solid.width
            }

            this.vx = 0
            rect.x = this.x
        }
    }

    private moveVertical(distance: number): void {
        this.y += distance
        this.grounded = false

        const rect = this.getRect()
        for (const solid of this.solids) {
            if (!rectsIntersect(rect, solid)) continue

            if (distance > 0) {
                this.y = solid.y - this.height
                this.grounded = true
            } else if (distance < 0) {
                this.y = solid.y + solid.height
            }

            this.vy = 0
            rect.y = this.y
        }
    }
}
