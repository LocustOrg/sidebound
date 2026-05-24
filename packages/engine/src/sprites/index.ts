import type { AssetId, AssetStore } from '../assets'

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
    readonly image: CanvasImageSource
}

export class SpriteSheet {
    readonly image: CanvasImageSource
    readonly layout: TextureAtlasLayout

    constructor(options: SpriteSheetOptions) {
        this.image = options.image
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

    drawFrame(context: CanvasRenderingContext2D, frameIndex: number, x: number, y: number, flipX = false): void {
        const frame = this.layout.frameAt(frameIndex)
        this.drawFrameAt(context, frame.col, frame.row, x, y, flipX)
    }

    drawFrameAt(context: CanvasRenderingContext2D, col: number, row: number, x: number, y: number, flipX = false): void {
        const sx = col * this.frameWidth
        const sy = row * this.frameHeight

        if (flipX) {
            context.save()
            context.translate(x + this.frameWidth, y)
            context.scale(-1, 1)
            context.drawImage(this.image, sx, sy, this.frameWidth, this.frameHeight, 0, 0, this.frameWidth, this.frameHeight)
            context.restore()
            return
        }

        context.drawImage(this.image, sx, sy, this.frameWidth, this.frameHeight, x, y, this.frameWidth, this.frameHeight)
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

    return new SpriteSheet({ image: image.image, frameWidth, frameHeight, columns, rows })
}

export function createProceduralSheet(
    frameWidth: number,
    frameHeight: number,
    columns: number,
    rows: number,
    draw: (context: CanvasRenderingContext2D, frameWidth: number, frameHeight: number) => void,
): SpriteSheet {
    const canvas = document.createElement('canvas')
    canvas.width = columns * frameWidth
    canvas.height = rows * frameHeight
    const context = canvas.getContext('2d')

    if (!context) {
        throw new Error('Failed to create procedural sprite sheet canvas context')
    }

    context.imageSmoothingEnabled = false
    draw(context, frameWidth, frameHeight)

    return new SpriteSheet({ image: canvas, frameWidth, frameHeight, columns, rows })
}

export function createBitmapSheet(
    frameWidth: number,
    frameHeight: number,
    columns: number,
    rows: number,
    palette: readonly string[],
    frames: readonly (readonly (readonly number[])[] | null)[],
): SpriteSheet {
    const canvas = document.createElement('canvas')
    canvas.width = columns * frameWidth
    canvas.height = rows * frameHeight
    const context = canvas.getContext('2d')

    if (!context) {
        throw new Error('Failed to create bitmap sprite sheet canvas context')
    }

    context.imageSmoothingEnabled = false

    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index]
        if (!frame) continue

        const col = index % columns
        const row = Math.floor(index / columns)
        const ox = col * frameWidth
        const oy = row * frameHeight

        for (let y = 0; y < frame.length; y += 1) {
            const line = frame[y]
            if (!line) continue

            for (let x = 0; x < line.length; x += 1) {
                const colorIndex = line[x]
                if (colorIndex === 0 || colorIndex === undefined) continue

                const color = palette[colorIndex]
                if (!color) continue

                context.fillStyle = color
                context.fillRect(ox + x, oy + y, 1, 1)
            }
        }
    }

    return new SpriteSheet({ image: canvas, frameWidth, frameHeight, columns, rows })
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

    draw(context: CanvasRenderingContext2D, x: number, y: number, flipX = false): void {
        this.sheet.drawFrame(context, this.currentFrame, x, y, flipX)
    }
}

export { SpriteAnimator as Animator }

