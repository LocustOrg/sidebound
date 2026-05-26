/**
 * SDL3 renderer implementing the engine Renderer2D interface.
 */

import { type Render, SDL, type Texture } from '@sdl3/sdl3-deno'
import type { ColorRgba, DrawOptions, Rect, Renderer2D, RendererImageSource, RenderTargetHandle, TextureHandle, Vec2 } from '@sidebound/engine'
import { loadSdlSurface } from './assets.ts'

type SdlTextureEntry = {
    readonly handle: TextureHandle
    readonly texture: Texture
}

type SdlRenderTargetEntry = {
    readonly handle: RenderTargetHandle
    readonly texture: Texture
}

function clampByte(value: number): number {
    if (!Number.isFinite(value)) {
        return 0
    }

    return Math.max(0, Math.min(255, Math.round(value)))
}

function alphaByte(alpha: number): number {
    return clampByte(alpha * 255)
}

function colorAlpha(color: ColorRgba): number {
    return Math.max(0, Math.min(1, color.a))
}

function sdlError(action: string): Error {
    const details = SDL.getError()
    return new Error(details ? `${action}: ${details}` : action)
}

function assertSdl(ok: boolean, action: string): void {
    if (!ok) {
        throw sdlError(action)
    }
}

function toSdlRect(rect: Rect): { readonly x: number; readonly y: number; readonly w: number; readonly h: number } {
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height }
}

export class SdlRenderer implements Renderer2D {
    private readonly render: Render
    private readonly textures = new Map<string, SdlTextureEntry>()
    private readonly renderTargets = new Map<string, SdlRenderTargetEntry>()
    private readonly renderTargetTextureIds = new Set<string>()
    private currentRenderTarget: RenderTargetHandle | null = null

    constructor(render: Render, _width: number, _height: number) {
        this.render = render
    }

    beginFrame(clearColor: ColorRgba): void {
        this.setDrawColor(clearColor)
        assertSdl(this.render.clear(), 'SDL_RenderClear failed')
    }

    endFrame(): void {
        if (this.currentRenderTarget) {
            this.setRenderTarget(null)
        }

        assertSdl(this.render.present(), 'SDL_RenderPresent failed')
    }

    createRenderTarget(id: string, width: number, height: number): RenderTargetHandle {
        const existing = this.renderTargets.get(id)
        if (existing) {
            return existing.handle
        }

        const texture = this.render.createTexture(SDL.PIXELFORMAT.RGBA8888, SDL.TEXTUREACCESS.TARGET, width, height)
        assertSdl(texture.setBlendMode(SDL.BLENDMODE.BLEND), `SDL_SetTextureBlendMode failed for render target '${id}'`)
        assertSdl(texture.setScaleMode(SDL.SCALEMODE.NEAREST), `SDL_SetTextureScaleMode failed for render target '${id}'`)

        const handle = { id, width, height }
        this.renderTargets.set(id, { handle, texture })
        this.textures.set(id, { handle, texture })
        this.renderTargetTextureIds.add(id)
        return handle
    }

    setRenderTarget(target: RenderTargetHandle | null): void {
        const entry = target ? this.renderTargets.get(target.id) : null

        if (target && !entry) {
            throw new Error(`SDL render target '${target.id}' has not been created`)
        }

        assertSdl(
            this.render.setTarget(entry?.texture ?? null),
            target ? `SDL_SetRenderTarget failed for '${target.id}'` : 'SDL_SetRenderTarget failed for window',
        )
        this.currentRenderTarget = target
    }

    async loadTexture(id: string, source: RendererImageSource): Promise<TextureHandle> {
        const existing = this.textures.get(id)
        if (existing) {
            return existing.handle
        }

        const surface = await loadSdlSurface(source)
        try {
            const detail = surface.detail
            const texture = this.render.createTextureFromSurface(surface.pointer!)
            assertSdl(texture.setBlendMode(SDL.BLENDMODE.BLEND), `SDL_SetTextureBlendMode failed for texture '${id}'`)
            assertSdl(texture.setScaleMode(SDL.SCALEMODE.NEAREST), `SDL_SetTextureScaleMode failed for texture '${id}'`)

            const handle = { id, width: detail.w, height: detail.h }
            this.textures.set(id, { handle, texture })
            return handle
        } catch (error) {
            throw new Error(
                `Failed to create SDL texture '${id}' from ${this.describeSource(source)}: ${error instanceof Error ? error.message : String(error)}`,
                { cause: error },
            )
        } finally {
            surface.destroy()
        }
    }

    drawTexture(texture: TextureHandle, source: Rect, dest: Rect, options: DrawOptions = {}): void {
        const entry = this.resolveTexture(texture)
        const tint = options.tint
        const alpha = Math.max(0, Math.min(1, (options.alpha ?? 1) * (tint?.a ?? 1)))

        assertSdl(
            entry.texture.setColorMod(clampByte(tint?.r ?? 255), clampByte(tint?.g ?? 255), clampByte(tint?.b ?? 255)),
            `SDL_SetTextureColorMod failed for texture '${texture.id}'`,
        )
        assertSdl(entry.texture.setAlphaMod(alphaByte(alpha)), `SDL_SetTextureAlphaMod failed for texture '${texture.id}'`)

        const sourceRect = toSdlRect(source)
        const destRect = toSdlRect(dest)
        const rendered = options.flipX
            ? this.render.textureRotated(entry.texture, sourceRect, destRect, 0, null, SDL.FLIP.HORIZONTAL)
            : this.render.texture(entry.texture, sourceRect, destRect)

        assertSdl(rendered, `SDL_RenderTexture failed for texture '${texture.id}'`)

        if (tint || alpha !== 1) {
            assertSdl(entry.texture.setColorMod(255, 255, 255), `SDL_SetTextureColorMod reset failed for texture '${texture.id}'`)
            assertSdl(entry.texture.setAlphaMod(255), `SDL_SetTextureAlphaMod reset failed for texture '${texture.id}'`)
        }
    }

    fillRect(rect: Rect, color: ColorRgba): void {
        this.setDrawColor(color)
        assertSdl(this.render.fillRect(toSdlRect(rect)), 'SDL_RenderFillRect failed')
    }

    strokeRect(rect: Rect, color: ColorRgba): void {
        this.setDrawColor(color)
        assertSdl(this.render.rect(toSdlRect(rect)), 'SDL_RenderRect failed')
    }

    drawLine(from: Vec2, to: Vec2, color: ColorRgba): void {
        this.setDrawColor(color)
        assertSdl(this.render.line(from.x, from.y, to.x, to.y), 'SDL_RenderLine failed')
    }

    drawPolygon(points: readonly Vec2[], color: ColorRgba): void {
        if (points.length < 2) return

        this.setDrawColor(color)

        for (let i = 0; i < points.length; i++) {
            const next = (i + 1) % points.length
            assertSdl(this.render.line(points[i].x, points[i].y, points[next].x, points[next].y), 'SDL_RenderLine failed while drawing polygon')
        }
    }

    dispose(): void {
        for (const [id, entry] of this.textures) {
            if (!this.renderTargetTextureIds.has(id)) {
                entry.texture.destroy()
            }

            this.textures.delete(id)
        }

        for (const [id, entry] of this.renderTargets) {
            entry.texture.destroy()
            this.renderTargets.delete(id)
            this.renderTargetTextureIds.delete(id)
        }
    }

    private resolveTexture(texture: TextureHandle): SdlTextureEntry {
        const loaded = this.textures.get(texture.id)
        if (loaded) {
            return loaded
        }

        throw new Error(`SDL texture '${texture.id}' has not been loaded`)
    }

    private setDrawColor(color: ColorRgba): void {
        assertSdl(this.render.setDrawBlendMode(colorAlpha(color) < 1 ? SDL.BLENDMODE.BLEND : SDL.BLENDMODE.NONE), 'SDL_SetRenderDrawBlendMode failed')
        assertSdl(
            this.render.setDrawColor(clampByte(color.r), clampByte(color.g), clampByte(color.b), alphaByte(colorAlpha(color))),
            'SDL_SetRenderDrawColor failed',
        )
    }

    private describeSource(source: RendererImageSource): string {
        if (source.kind === 'file') {
            return `'${source.path}'`
        }

        if (source.kind === 'bytes') {
            return `${source.bytes.byteLength} bytes`
        }

        return 'an opaque platform source'
    }
}
