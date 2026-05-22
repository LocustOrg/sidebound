/**
 * Lightweight sprite-sheet representation.
 * A SpriteSheet owns one HTMLCanvasElement (or OffscreenCanvas) that contains
 * all frames in a grid. Individual frames can be drawn to any context by index.
 */

export type SpriteFrame = {
    /** Column in the grid (0-based) */
    col: number
    /** Row in the grid (0-based) */
    row: number
}

export type SpriteSheetOptions = {
    /** The source image (can be an Image, Canvas, or OffscreenCanvas) */
    image: CanvasImageSource
    /** Width of a single frame in pixels */
    frameWidth: number
    /** Height of a single frame in pixels */
    frameHeight: number
    /** Total columns in the sheet */
    columns: number
    /** Total rows in the sheet */
    rows: number
}

export class SpriteSheet {
    readonly image: CanvasImageSource
    readonly frameWidth: number
    readonly frameHeight: number
    readonly columns: number
    readonly rows: number

    constructor(options: SpriteSheetOptions) {
        this.image = options.image
        this.frameWidth = options.frameWidth
        this.frameHeight = options.frameHeight
        this.columns = options.columns
        this.rows = options.rows
    }

    /** Total number of frames in the sheet */
    get frameCount(): number {
        return this.columns * this.rows
    }

    /** Draw a frame by linear index at the given position */
    drawFrame(context: CanvasRenderingContext2D, frameIndex: number, x: number, y: number, flipX = false): void {
        const col = frameIndex % this.columns
        const row = Math.floor(frameIndex / this.columns)
        this.drawFrameAt(context, col, row, x, y, flipX)
    }

    /** Draw a frame by grid position at the given world position */
    drawFrameAt(context: CanvasRenderingContext2D, col: number, row: number, x: number, y: number, flipX = false): void {
        const sx = col * this.frameWidth
        const sy = row * this.frameHeight

        if (flipX) {
            context.save()
            context.translate(x + this.frameWidth, y)
            context.scale(-1, 1)
            context.drawImage(this.image, sx, sy, this.frameWidth, this.frameHeight, 0, 0, this.frameWidth, this.frameHeight)
            context.restore()
        } else {
            context.drawImage(this.image, sx, sy, this.frameWidth, this.frameHeight, x, y, this.frameWidth, this.frameHeight)
        }
    }
}

/**
 * Create a SpriteSheet from a programmatically drawn canvas.
 * The `draw` callback receives a context sized to fit all frames.
 */
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
    const context = canvas.getContext('2d')!
    context.imageSmoothingEnabled = false
    draw(context, frameWidth, frameHeight)

    return new SpriteSheet({ image: canvas, frameWidth, frameHeight, columns, rows })
}

/**
 * Create a SpriteSheet from bitmap frame data.
 * Each frame is a 2D array of palette indices (0 = transparent).
 * This is the most reliable way to define pixel-art sprites — you can
 * literally see what each frame looks like in the source code.
 */
export function createBitmapSheet(
    frameWidth: number,
    frameHeight: number,
    columns: number,
    rows: number,
    palette: string[],
    frames: (number[][] | null)[],
): SpriteSheet {
    const canvas = document.createElement('canvas')
    canvas.width = columns * frameWidth
    canvas.height = rows * frameHeight
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i]
        if (!frame) continue

        const col = i % columns
        const row = Math.floor(i / columns)
        const ox = col * frameWidth
        const oy = row * frameHeight

        for (let y = 0; y < frame.length; y++) {
            const line = frame[y]
            if (!line) continue
            for (let x = 0; x < line.length; x++) {
                const colorIndex = line[x]
                if (colorIndex === 0 || colorIndex === undefined) continue
                const color = palette[colorIndex]
                if (!color) continue
                ctx.fillStyle = color
                ctx.fillRect(ox + x, oy + y, 1, 1)
            }
        }
    }

    return new SpriteSheet({ image: canvas, frameWidth, frameHeight, columns, rows })
}
