import { EngineLoop, type EngineClock } from './loop'
import type { ImageSource, RenderContext } from './render-context'
import type { OffscreenSurface, PlatformAdapter, PlatformClock, PlatformImageAsset } from './adapter'

export type PixelLoop = {
    update(deltaSeconds: number): void
    render(context: RenderContext): void
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
    readonly context: RenderContext
    readonly width: number
    readonly height: number
    readonly platformScale: number
    clear(): void
    dispose(): void
}

export type PixelEngineOptions = PixelCanvasSurfaceOptions & {
    readonly loop: PixelLoop
    readonly clock?: EngineClock
    readonly platform?: PlatformAdapter
}

/**
 * Wraps a CanvasRenderingContext2D as a platform-agnostic RenderContext.
 */
export function wrapCanvasContext(ctx: CanvasRenderingContext2D): RenderContext {
    return ctx as unknown as RenderContext
}

export class BrowserAnimationFrameClock implements EngineClock, PlatformClock {
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

/**
 * Browser implementation of the PlatformAdapter interface.
 */
export class BrowserPlatformAdapter implements PlatformAdapter {
    readonly clock: PlatformClock = new BrowserAnimationFrameClock()

    loadImage(url: string): Promise<PlatformImageAsset> {
        return new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () =>
                resolve({
                    id: url,
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                    // The HTMLImageElement itself serves as the ImageSource for browser canvas
                } as PlatformImageAsset & HTMLImageElement)
            image.onerror = () => reject(new Error(`Failed to load image from ${url}`))
            image.src = url
        })
    }

    createOffscreenSurface(width: number, height: number): OffscreenSurface {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
            throw new Error('Failed to create offscreen canvas context')
        }

        ctx.imageSmoothingEnabled = false
        const context = wrapCanvasContext(ctx)

        return {
            context,
            width,
            height,
            toImageSource(): ImageSource {
                return canvas as unknown as ImageSource
            },
        }
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
    const ctx = canvas.getContext('2d')

    if (!ctx) {
        throw new Error('Pixel canvas surface requires a 2D canvas context')
    }

    configurePixelCanvas(canvas, width, height, scale, platformScale)
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(platformScale, 0, 0, platformScale, 0, 0)

    const context = wrapCanvasContext(ctx)

    return {
        canvas,
        context,
        width,
        height,
        platformScale,
        clear() {
            ctx.save()
            ctx.setTransform(platformScale, 0, 0, platformScale, 0, 0)
            ctx.fillStyle = background
            ctx.fillRect(0, 0, width, height)
            ctx.restore()
        },
        dispose() {
            ctx.setTransform(1, 0, 0, 1, 0, 0)
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
