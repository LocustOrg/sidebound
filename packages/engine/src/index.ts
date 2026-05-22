export type PixelLoop = {
    update(deltaSeconds: number): void
    render(context: CanvasRenderingContext2D): void
}

export type PixelEngineOptions = {
    canvas: HTMLCanvasElement
    width: number
    height: number
    loop: PixelLoop
    scale?: number | 'css'
    background?: string
}

export class PixelEngine {
    private readonly canvas: HTMLCanvasElement
    private readonly context: CanvasRenderingContext2D
    private readonly loop: PixelLoop
    private readonly background: string
    private readonly width: number
    private readonly height: number
    private animationFrameId: number | undefined
    private lastFrameTime = 0

    constructor({ canvas, width, height, loop, scale = 4, background = '#101018' }: PixelEngineOptions) {
        const context = canvas.getContext('2d')

        if (!context) {
            throw new Error('PixelEngine requires a 2D canvas context')
        }

        this.canvas = canvas
        this.context = context
        this.loop = loop
        this.background = background
        this.width = width
        this.height = height

        this.canvas.width = width
        this.canvas.height = height
        if (scale !== 'css') {
            this.canvas.style.width = `${width * scale}px`
            this.canvas.style.height = `${height * scale}px`
        }

        this.context.imageSmoothingEnabled = false
    }

    start(): void {
        if (this.animationFrameId !== undefined) {
            return
        }

        this.lastFrameTime = performance.now()
        this.animationFrameId = requestAnimationFrame(this.tick)
    }

    stop(): void {
        if (this.animationFrameId === undefined) {
            return
        }

        cancelAnimationFrame(this.animationFrameId)
        this.animationFrameId = undefined
    }

    private readonly tick = (time: number): void => {
        const deltaSeconds = (time - this.lastFrameTime) / 1000
        this.lastFrameTime = time

        this.loop.update(deltaSeconds)
        this.clear()
        this.loop.render(this.context)

        this.animationFrameId = requestAnimationFrame(this.tick)
    }

    private clear(): void {
        this.context.fillStyle = this.background
        this.context.fillRect(0, 0, this.width, this.height)
    }
}
