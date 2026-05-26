import type { AssetId, AssetStore } from '../assets/asset-store.ts'
import type { Renderer2D, RendererImageSource, TextureHandle } from '../platform/renderer.ts'

export type SpriteFrame = {
    readonly col: number
    readonly row: number
}

export type TextureAtlasLayoutOptions = {
    readonly frameWidth: number
    readonly frameHeight: number
    readonly columns: number
    readonly rows: number
}

function assertPositiveInteger(name: string, value: number): void {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`)
    }
}

export class TextureAtlasLayout {
    readonly frameWidth: number
    readonly frameHeight: number
    readonly columns: number
    readonly rows: number

    constructor(options: TextureAtlasLayoutOptions) {
        assertPositiveInteger('frameWidth', options.frameWidth)
        assertPositiveInteger('frameHeight', options.frameHeight)
        assertPositiveInteger('columns', options.columns)
        assertPositiveInteger('rows', options.rows)

        this.frameWidth = options.frameWidth
        this.frameHeight = options.frameHeight
        this.columns = options.columns
        this.rows = options.rows
    }

    get frameCount(): number {
        return this.columns * this.rows
    }

    get width(): number {
        return this.frameWidth * this.columns
    }

    get height(): number {
        return this.frameHeight * this.rows
    }

    frameAt(frameIndex: number): SpriteFrame {
        this.assertFrame(frameIndex)

        return {
            col: frameIndex % this.columns,
            row: Math.floor(frameIndex / this.columns),
        }
    }

    assertFrame(frameIndex: number): void {
        if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= this.frameCount) {
            throw new Error(`Frame ${frameIndex} is outside atlas layout bounds 0..${this.frameCount - 1}`)
        }
    }
}

export type SpriteSheetOptions = TextureAtlasLayoutOptions & {
    readonly texture: TextureHandle
}

export class SpriteSheet {
    readonly texture: TextureHandle
    readonly layout: TextureAtlasLayout

    constructor(options: SpriteSheetOptions) {
        this.texture = options.texture
        this.layout = new TextureAtlasLayout(options)
    }

    get frameWidth(): number {
        return this.layout.frameWidth
    }

    get frameHeight(): number {
        return this.layout.frameHeight
    }

    get columns(): number {
        return this.layout.columns
    }

    get rows(): number {
        return this.layout.rows
    }

    get frameCount(): number {
        return this.layout.frameCount
    }

    drawFrame(renderer: Renderer2D, frameIndex: number, x: number, y: number, flipX = false): void {
        const frame = this.layout.frameAt(frameIndex)
        this.drawFrameAt(renderer, frame.col, frame.row, x, y, flipX)
    }

    drawFrameAt(renderer: Renderer2D, col: number, row: number, x: number, y: number, flipX = false): void {
        renderer.drawTexture(
            this.texture,
            { x: col * this.frameWidth, y: row * this.frameHeight, width: this.frameWidth, height: this.frameHeight },
            { x, y, width: this.frameWidth, height: this.frameHeight },
            { flipX },
        )
    }
}

type SourceBackedTextureHandle = TextureHandle & {
    readonly source: RendererImageSource
}

function textureHandleFromImage(id: AssetId, source: RendererImageSource): SourceBackedTextureHandle {
    return {
        id,
        width: source.width,
        height: source.height,
        source,
    }
}

export async function loadSpriteSheet(
    assetStore: AssetStore,
    assetId: AssetId,
    frameWidth: number,
    frameHeight: number,
    columns: number,
    rows: number,
): Promise<SpriteSheet> {
    const image = await assetStore.loadImage(assetId)
    const layout = new TextureAtlasLayout({ frameWidth, frameHeight, columns, rows })

    if (image.width !== layout.width || image.height !== layout.height) {
        throw new Error(
            `Image asset '${assetId}' is ${image.width}x${image.height}, expected ${layout.width}x${layout.height} for ${columns}x${rows} ${frameWidth}x${frameHeight} frames`,
        )
    }

    return new SpriteSheet({ texture: textureHandleFromImage(assetId, image.image), frameWidth, frameHeight, columns, rows })
}

export type AnimationClip = {
    readonly name: string
    readonly frames: readonly number[]
    readonly frameDuration: number
    readonly loop: boolean
}

export type SpriteClipDefinition = {
    readonly frames: readonly number[]
    readonly fps?: number
    readonly frameDuration?: number
    readonly loop: boolean
}

export function resolveSpriteClipFrameDuration(clip: SpriteClipDefinition): number {
    if (clip.frameDuration !== undefined) {
        return clip.frameDuration
    }

    if (clip.fps !== undefined && clip.fps > 0) {
        return 1 / clip.fps
    }

    throw new Error('Animation clip must define a positive fps or frameDuration')
}

export function createAnimationClip(name: string, clip: SpriteClipDefinition): AnimationClip {
    return {
        name,
        frames: clip.frames,
        frameDuration: resolveSpriteClipFrameDuration(clip),
        loop: clip.loop,
    }
}

export function createAnimationClips(clips: Readonly<Record<string, SpriteClipDefinition>>): AnimationClip[] {
    return Object.entries(clips).map(([name, clip]) => createAnimationClip(name, clip))
}

export function registerSpriteAnimationClips(
    animator: { addClip(clip: AnimationClip): unknown; play(name: string): void },
    clips: Readonly<Record<string, SpriteClipDefinition>>,
    initialClip = 'idle',
): void {
    for (const clip of createAnimationClips(clips)) {
        animator.addClip(clip)
    }

    animator.play(initialClip)
}

export class SpriteAnimator {
    private readonly clips = new Map<string, AnimationClip>()
    private currentClip: AnimationClip | null = null
    private timer = 0
    private frameIndex = 0
    private finishedClip = false
    private currentPlaybackRate = 1

    readonly sheet: SpriteSheet

    constructor(sheet: SpriteSheet) {
        this.sheet = sheet
    }

    addClip(clip: AnimationClip): this {
        for (const frame of clip.frames) {
            this.sheet.layout.assertFrame(frame)
        }

        this.clips.set(clip.name, clip)
        return this
    }

    play(name: string, force = false): void {
        const clip = this.clips.get(name)
        if (!clip) return

        if (this.currentClip === clip && !force && !this.finishedClip) return

        this.currentClip = clip
        this.timer = 0
        this.frameIndex = 0
        this.finishedClip = false
    }

    update(deltaSeconds: number): void {
        if (!this.currentClip || this.finishedClip) return

        const clip = this.currentClip
        const scaledDeltaSeconds = deltaSeconds * this.currentPlaybackRate

        if (scaledDeltaSeconds <= 0 || clip.frameDuration <= 0) {
            return
        }

        this.timer += scaledDeltaSeconds

        while (this.timer >= clip.frameDuration) {
            this.timer -= clip.frameDuration
            this.frameIndex += 1

            if (this.frameIndex < clip.frames.length) continue

            if (clip.loop) {
                this.frameIndex = 0
            } else {
                this.frameIndex = clip.frames.length - 1
                this.finishedClip = true
                break
            }
        }
    }

    get currentFrame(): number {
        if (!this.currentClip) return 0
        return this.currentClip.frames[this.frameIndex] ?? 0
    }

    get currentClipName(): string {
        return this.currentClip?.name ?? ''
    }

    get finished(): boolean {
        return this.finishedClip
    }

    get playbackRate(): number {
        return this.currentPlaybackRate
    }

    set playbackRate(value: number) {
        this.currentPlaybackRate = Number.isFinite(value) ? Math.max(0, value) : 1
    }

    draw(renderer: Renderer2D, x: number, y: number, flipX = false): void {
        this.sheet.drawFrame(renderer, this.currentFrame, x, y, flipX)
    }
}

export { SpriteAnimator as Animator }
