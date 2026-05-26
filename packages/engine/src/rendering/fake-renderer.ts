/**
 * Recording fake Renderer2D for testing render pipeline output
 * without SDL3 or any native dependencies.
 */

import type { ColorRgba, DrawOptions, LinearGradientStop, Renderer2D, RendererBlendMode, RendererImageSource, RenderTargetHandle, TextureHandle } from '../platform/renderer.ts'
import type { Rect, Vec2 } from '../core/geometry.ts'

export type RenderCommand =
    | { type: 'beginFrame'; clearColor: ColorRgba }
    | { type: 'endFrame' }
    | { type: 'createRenderTarget'; id: string; width: number; height: number }
    | { type: 'setRenderTarget'; target: RenderTargetHandle | null }
    | { type: 'loadTexture'; id: string }
    | { type: 'drawTexture'; textureId: string; source: Rect; dest: Rect; options?: DrawOptions }
    | { type: 'clear'; color: ColorRgba }
    | { type: 'drawRenderTarget'; targetId: string; dest: Rect; blendMode: RendererBlendMode; alpha?: number }
    | { type: 'fillLinearGradientRect'; rect: Rect; stops: readonly LinearGradientStop[] }
    | { type: 'fillRadialGradientFan'; center: Vec2; radius: number; innerColor: ColorRgba; outerColor: ColorRgba; segments?: number }
    | { type: 'fillRadialGradientEllipse'; center: Vec2; radiusX: number; radiusY: number; innerColor: ColorRgba; outerColor: ColorRgba; segments?: number }
    | { type: 'fillRect'; rect: Rect; color: ColorRgba }
    | { type: 'strokeRect'; rect: Rect; color: ColorRgba }
    | { type: 'drawLine'; from: Vec2; to: Vec2; color: ColorRgba }
    | { type: 'drawPolygon'; points: readonly Vec2[]; color: ColorRgba }
    | { type: 'fillTriangleFan'; origin: Vec2; points: readonly Vec2[]; color: ColorRgba }

export class FakeRenderer implements Renderer2D {
    private commands: RenderCommand[] = []
    private nextTargetId = 0

    getCommands(): readonly RenderCommand[] {
        return this.commands
    }

    reset(): void {
        this.commands = []
    }

    getCommandsByType<T extends RenderCommand['type']>(type: T): Extract<RenderCommand, { type: T }>[] {
        return this.commands.filter((cmd) => cmd.type === type) as Extract<RenderCommand, { type: T }>[]
    }

    beginFrame(clearColor: ColorRgba): void {
        this.commands.push({ type: 'beginFrame', clearColor })
    }

    endFrame(): void {
        this.commands.push({ type: 'endFrame' })
    }

    createRenderTarget(id: string, width: number, height: number): RenderTargetHandle {
        this.commands.push({ type: 'createRenderTarget', id, width, height })
        this.nextTargetId++
        return { id, width, height }
    }

    setRenderTarget(target: RenderTargetHandle | null): void {
        this.commands.push({ type: 'setRenderTarget', target })
    }

    loadTexture(id: string, _source: RendererImageSource): Promise<TextureHandle> {
        this.commands.push({ type: 'loadTexture', id })
        return Promise.resolve({ id, width: 32, height: 32 })
    }

    drawTexture(texture: TextureHandle, source: Rect, dest: Rect, options?: DrawOptions): void {
        this.commands.push({ type: 'drawTexture', textureId: texture.id, source, dest, options })
    }

    clear(color: ColorRgba): void {
        this.commands.push({ type: 'clear', color })
    }

    drawRenderTarget(target: RenderTargetHandle, dest: Rect, blendMode: RendererBlendMode, alpha?: number): void {
        this.commands.push({ type: 'drawRenderTarget', targetId: target.id, dest, blendMode, alpha })
    }

    fillLinearGradientRect(rect: Rect, stops: readonly LinearGradientStop[]): void {
        this.commands.push({ type: 'fillLinearGradientRect', rect, stops })
    }

    fillRadialGradientFan(center: Vec2, radius: number, innerColor: ColorRgba, outerColor: ColorRgba, segments?: number): void {
        this.commands.push({ type: 'fillRadialGradientFan', center, radius, innerColor, outerColor, segments })
    }

    fillRadialGradientEllipse(center: Vec2, radiusX: number, radiusY: number, innerColor: ColorRgba, outerColor: ColorRgba, segments?: number): void {
        this.commands.push({ type: 'fillRadialGradientEllipse', center, radiusX, radiusY, innerColor, outerColor, segments })
    }

    fillRect(rect: Rect, color: ColorRgba): void {
        this.commands.push({ type: 'fillRect', rect, color })
    }

    strokeRect(rect: Rect, color: ColorRgba): void {
        this.commands.push({ type: 'strokeRect', rect, color })
    }

    drawLine(from: Vec2, to: Vec2, color: ColorRgba): void {
        this.commands.push({ type: 'drawLine', from, to, color })
    }

    drawPolygon(points: readonly Vec2[], color: ColorRgba): void {
        this.commands.push({ type: 'drawPolygon', points, color })
    }

    fillTriangleFan(origin: Vec2, points: readonly Vec2[], color: ColorRgba): void {
        this.commands.push({ type: 'fillTriangleFan', origin, points, color })
    }
}



