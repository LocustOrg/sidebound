import type { SpriteSheet } from './sprite-sheet'

/**
 * A named animation clip referencing frames in a SpriteSheet.
 */
export type AnimationClip = {
    /** Name identifier (e.g. 'idle', 'run', 'jump') */
    name: string
    /** Frame indices into the sprite sheet (linear) */
    frames: number[]
    /** Seconds per frame */
    frameDuration: number
    /** Whether the animation loops */
    loop: boolean
}

/**
 * Animator drives frame selection from a set of named clips.
 * Keeps no per-frame allocations — just advances a timer and resolves the current frame.
 */
export class Animator {
    private readonly clips: Map<string, AnimationClip> = new Map()
    private currentClip: AnimationClip | null = null
    private timer = 0
    private frameIndex = 0
    private _finished = false

    readonly sheet: SpriteSheet

    constructor(sheet: SpriteSheet) {
        this.sheet = sheet
    }

    addClip(clip: AnimationClip): this {
        this.clips.set(clip.name, clip)
        return this
    }

    /** Play a clip by name. If already playing, restarts only if `force` is true. */
    play(name: string, force = false): void {
        const clip = this.clips.get(name)
        if (!clip) return

        if (this.currentClip === clip && !force && !this._finished) return

        this.currentClip = clip
        this.timer = 0
        this.frameIndex = 0
        this._finished = false
    }

    /** Advance the animation timer */
    update(deltaSeconds: number): void {
        if (!this.currentClip || this._finished) return

        this.timer += deltaSeconds
        const clip = this.currentClip

        while (this.timer >= clip.frameDuration) {
            this.timer -= clip.frameDuration
            this.frameIndex += 1

            if (this.frameIndex >= clip.frames.length) {
                if (clip.loop) {
                    this.frameIndex = 0
                } else {
                    this.frameIndex = clip.frames.length - 1
                    this._finished = true
                    break
                }
            }
        }
    }

    /** Current frame index into the sprite sheet */
    get currentFrame(): number {
        if (!this.currentClip) return 0
        return this.currentClip.frames[this.frameIndex] ?? 0
    }

    /** Name of the currently playing clip */
    get currentClipName(): string {
        return this.currentClip?.name ?? ''
    }

    /** Whether the current (non-looping) clip has finished */
    get finished(): boolean {
        return this._finished
    }

    /** Draw the current frame */
    draw(context: CanvasRenderingContext2D, x: number, y: number, flipX = false): void {
        this.sheet.drawFrame(context, this.currentFrame, x, y, flipX)
    }
}

