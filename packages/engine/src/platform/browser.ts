import { EngineLoop, type EngineClock } from './loop'

export type PixelLoop = {
    update(deltaSeconds: number): void
    render(context: CanvasRenderingContext2D): void
}

export type PixelScale = number | 'css'

export type PixelCanvasSurfaceOptions = {
    readonly canvas: HTMLCanvasElement
    readonly width: number
    readonly height: number
    readonly scale?: PixelScale
    readonly platformScale?: number
    readonly background?: string
}

export type PixelCanvasSurface = {
    readonly canvas: HTMLCanvasElement
    readonly context: CanvasRenderingContext2D
    readonly width: number
    readonly height: number
    readonly platformScale: number
    clear(): void
    dispose(): void
}

export type PixelEngineOptions = PixelCanvasSurfaceOptions & {
    readonly loop: PixelLoop
    readonly clock?: EngineClock
}

export class BrowserAnimationFrameClock implements EngineClock {
    now(): number {
        return performance.now()
    }

    requestFrame(callback: (now: number) => void): number {
        return requestAnimationFrame(callback)
    }

    cancelFrame(frameId: number): void {
        cancelAnimationFrame(frameId)
    }
}

export function configurePixelCanvas(canvas: HTMLCanvasElement, width: number, height: number, scale: PixelScale = 4, platformScale = 1): void {
    const safePlatformScale = Math.max(1, Math.floor(platformScale))

    canvas.width = width * safePlatformScale
    canvas.height = height * safePlatformScale

    if (scale !== 'css') {
        canvas.style.width = `${width * scale}px`
        canvas.style.height = `${height * scale}px`
    }

    canvas.style.imageRendering = 'pixelated'
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement, platformScale = globalThis.devicePixelRatio || 1): boolean {
    const width = Math.max(1, Math.round(canvas.clientWidth * platformScale))
    const height = Math.max(1, Math.round(canvas.clientHeight * platformScale))

    if (canvas.width === width && canvas.height === height) {
        return false
    }

    canvas.width = width
    canvas.height = height
    return true
}

export function createPixelCanvasSurface(options: PixelCanvasSurfaceOptions): PixelCanvasSurface {
    const { canvas, width, height, scale = 4, background = '#101018' } = options
    const platformScale = Math.max(1, Math.floor(options.platformScale ?? 1))
    const context = canvas.getContext('2d')

    if (!context) {
        throw new Error('Pixel canvas surface requires a 2D canvas context')
    }

    configurePixelCanvas(canvas, width, height, scale, platformScale)
    context.imageSmoothingEnabled = false
    context.setTransform(platformScale, 0, 0, platformScale, 0, 0)

    return {
        canvas,
        context,
        width,
        height,
        platformScale,
        clear() {
            context.save()
            context.setTransform(platformScale, 0, 0, platformScale, 0, 0)
            context.fillStyle = background
            context.fillRect(0, 0, width, height)
            context.restore()
        },
        dispose() {
            context.setTransform(1, 0, 0, 1, 0, 0)
        },
    }
}

export class PixelEngine {
    private readonly surface: PixelCanvasSurface
    private readonly loop: EngineLoop

    constructor(options: PixelEngineOptions) {
        this.surface = createPixelCanvasSurface(options)
        this.loop = new EngineLoop({
            clock: options.clock ?? new BrowserAnimationFrameClock(),
            update: ({ deltaSeconds }) => options.loop.update(deltaSeconds),
            render: () => {
                this.surface.clear()
                options.loop.render(this.surface.context)
            },
        })
    }

    start(): void {
        this.loop.start()
    }

    stop(): void {
        this.loop.stop()
    }

    dispose(): void {
        this.loop.dispose()
        this.surface.dispose()
    }
}
