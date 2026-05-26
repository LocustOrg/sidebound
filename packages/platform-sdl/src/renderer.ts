/**
 * SDL3 renderer implementing the engine Renderer2D interface.
 */

import type { Render } from '@sdl3/sdl3-deno'
import type { ColorRgba, DrawOptions, Rect, Renderer2D, RendererImageSource, RenderTargetHandle, TextureHandle, Vec2 } from '@sidebound/engine'

export class SdlRenderer implements Renderer2D {
    private readonly render: Render
    private readonly textures = new Map<string, TextureHandle>()

    constructor(render: Render, _width: number, _height: number) {
        this.render = render
    }

    beginFrame(clearColor: ColorRgba): void {
        this.render.setDrawColor(clearColor.r, clearColor.g, clearColor.b, Math.round(clearColor.a * 255))
        this.render.clear()
    }

    endFrame(): void {
        this.render.present()
    }

    createRenderTarget(id: string, width: number, height: number): RenderTargetHandle {
        return { id, width, height }
    }

    setRenderTarget(_target: RenderTargetHandle | null): void {
        // SDL render target switching will be implemented in Phase 4+
    }

    loadTexture(id: string, source: RendererImageSource): Promise<TextureHandle> {
        const handle: TextureHandle = { id, width: source.width, height: source.height }
        this.textures.set(id, handle)
        return Promise.resolve(handle)
    }

    drawTexture(_texture: TextureHandle, _source: Rect, _dest: Rect, _options?: DrawOptions): void {
        // Texture drawing will be fully implemented with asset loading in Phase 4
    }

    fillRect(rect: Rect, color: ColorRgba): void {
        this.render.setDrawColor(color.r, color.g, color.b, Math.round(color.a * 255))
        this.render.fillRect({ x: rect.x, y: rect.y, w: rect.width, h: rect.height })
    }

    strokeRect(rect: Rect, color: ColorRgba): void {
        this.render.setDrawColor(color.r, color.g, color.b, Math.round(color.a * 255))
        this.render.rect({ x: rect.x, y: rect.y, w: rect.width, h: rect.height })
    }

    drawLine(from: Vec2, to: Vec2, color: ColorRgba): void {
        this.render.setDrawColor(color.r, color.g, color.b, Math.round(color.a * 255))
        this.render.line(from.x, from.y, to.x, to.y)
    }

    drawPolygon(points: readonly Vec2[], color: ColorRgba): void {
        if (points.length < 2) return

        this.render.setDrawColor(color.r, color.g, color.b, Math.round(color.a * 255))

        for (let i = 0; i < points.length; i++) {
            const next = (i + 1) % points.length
            this.render.line(points[i].x, points[i].y, points[next].x, points[next].y)
        }
    }
}
