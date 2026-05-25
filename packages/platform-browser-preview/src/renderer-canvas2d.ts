import type {
    ColorRgba,
    DrawOptions,
    Rect,
    Renderer2D,
    RendererImageSource,
    RenderContext,
    RenderTargetHandle,
    TextureHandle,
    Vec2,
} from '@sidebound/engine'

type CanvasTexture = TextureHandle & {
    readonly source: RendererImageSource
}

function toCssRgba(color: ColorRgba): string {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`
}

export class Canvas2DPreviewRenderer implements Renderer2D {
    private readonly context: RenderContext
    private readonly width: number
    private readonly height: number
    private readonly textures = new Map<string, CanvasTexture>()

    constructor(context: RenderContext, width: number, height: number) {
        this.context = context
        this.width = width
        this.height = height
    }

    beginFrame(clearColor: ColorRgba): void {
        this.context.save()
        this.context.setTransform(1, 0, 0, 1, 0, 0)
        this.context.fillStyle = toCssRgba(clearColor)
        this.context.fillRect(0, 0, this.width, this.height)
        this.context.restore()
    }

    endFrame(): void {
        return undefined
    }

    createRenderTarget(id: string, width: number, height: number): RenderTargetHandle {
        return { id, width, height }
    }

    setRenderTarget(target: RenderTargetHandle | null): void {
        if (target) {
            throw new Error('Canvas preview render targets are not implemented yet')
        }
    }

    async loadTexture(id: string, source: RendererImageSource): Promise<TextureHandle> {
        const texture = { id, width: source.width, height: source.height, source }
        this.textures.set(id, texture)
        return texture
    }

    drawTexture(texture: TextureHandle, source: Rect, dest: Rect, options: DrawOptions = {}): void {
        const loaded = this.textures.get(texture.id)

        if (!loaded) {
            throw new Error(`Texture '${texture.id}' has not been loaded`)
        }

        this.context.save()
        this.context.globalAlpha = options.alpha ?? 1

        if (options.flipX) {
            this.context.translate(dest.x + dest.width, dest.y)
            this.context.scale(-1, 1)
            this.context.drawImage(loaded.source, source.x, source.y, source.width, source.height, 0, 0, dest.width, dest.height)
        } else {
            this.context.drawImage(loaded.source, source.x, source.y, source.width, source.height, dest.x, dest.y, dest.width, dest.height)
        }

        this.context.restore()
    }

    fillRect(rect: Rect, color: ColorRgba): void {
        this.context.save()
        this.context.fillStyle = toCssRgba(color)
        this.context.fillRect(rect.x, rect.y, rect.width, rect.height)
        this.context.restore()
    }

    strokeRect(rect: Rect, color: ColorRgba): void {
        this.context.save()
        this.context.strokeStyle = toCssRgba(color)
        this.context.strokeRect(rect.x, rect.y, rect.width, rect.height)
        this.context.restore()
    }

    drawLine(from: Vec2, to: Vec2, color: ColorRgba): void {
        this.context.save()
        this.context.strokeStyle = toCssRgba(color)
        this.context.beginPath()
        this.context.moveTo(from.x, from.y)
        this.context.lineTo(to.x, to.y)
        this.context.stroke()
        this.context.restore()
    }

    drawPolygon(points: readonly Vec2[], color: ColorRgba): void {
        if (points.length < 2) {
            return
        }

        this.context.save()
        this.context.fillStyle = toCssRgba(color)
        this.context.beginPath()
        this.context.moveTo(points[0].x, points[0].y)

        for (let index = 1; index < points.length; index += 1) {
            this.context.lineTo(points[index].x, points[index].y)
        }

        this.context.closePath()
        this.context.fill()
        this.context.restore()
    }
}
