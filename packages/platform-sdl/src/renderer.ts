/**
 * SDL3 renderer implementing the engine Renderer2D interface.
 */

import { type Render, SDL, type Texture } from '@sdl3/sdl3-deno'
import type {
    ColorRgba,
    DrawOptions,
    LinearGradientDirection,
    LinearGradientStop,
    Rect,
    Renderer2D,
    RendererBlendMode,
    RendererImageSource,
    RenderTargetHandle,
    TextureHandle,
    Vec2,
} from '@sidebound/engine'
import { loadSdlSurface } from './assets.ts'

export type SdlLogicalPresentationMode = 'disabled' | 'stretch' | 'letterbox' | 'overscan' | 'integer-scale'

export type SdlRendererOptions = {
    readonly logicalPresentationMode?: SdlLogicalPresentationMode
}

type SdlTextureEntry = {
    readonly handle: TextureHandle
    readonly texture: Texture
}

type SdlRenderTargetEntry = {
    readonly handle: RenderTargetHandle
    readonly texture: Texture
}

const polygonEpsilon = 0.0001

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

function toSdlFColor(color: ColorRgba): { readonly r: number; readonly g: number; readonly b: number; readonly a: number } {
    return {
        r: clampByte(color.r) / 255,
        g: clampByte(color.g) / 255,
        b: clampByte(color.b) / 255,
        a: colorAlpha(color),
    }
}

function triangleArea2(a: Vec2, b: Vec2, c: Vec2): number {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function polygonSignedArea2(points: readonly Vec2[]): number {
    let area = 0

    for (let i = 0; i < points.length; i++) {
        const current = points[i]
        const next = points[(i + 1) % points.length]
        area += current.x * next.y - next.x * current.y
    }

    return area
}

function arePointsClose(a: Vec2, b: Vec2): boolean {
    return Math.abs(a.x - b.x) <= polygonEpsilon && Math.abs(a.y - b.y) <= polygonEpsilon
}

function normalizePolygonPoints(points: readonly Vec2[]): Vec2[] {
    const normalized: Vec2[] = []

    for (const point of points) {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue

        const previous = normalized.at(-1)
        if (!previous || !arePointsClose(previous, point)) {
            normalized.push(point)
        }
    }

    if (normalized.length > 1 && arePointsClose(normalized[0], normalized[normalized.length - 1])) {
        normalized.pop()
    }

    return normalized
}

function isPointInsideTriangle(point: Vec2, a: Vec2, b: Vec2, c: Vec2, orientation: number): boolean {
    return (
        orientation * triangleArea2(a, b, point) > polygonEpsilon &&
        orientation * triangleArea2(b, c, point) > polygonEpsilon &&
        orientation * triangleArea2(c, a, point) > polygonEpsilon
    )
}

function triangulatePolygon(points: readonly Vec2[]): Int32Array<ArrayBuffer> | null {
    if (points.length < 3) return null

    const area = polygonSignedArea2(points)
    if (Math.abs(area) <= polygonEpsilon) return null

    const orientation = area >= 0 ? 1 : -1
    const remaining = points.map((_point, index) => index)
    const triangles: number[] = []
    let guard = points.length * points.length

    while (remaining.length > 3 && guard > 0) {
        guard -= 1
        let clipped = false

        for (let i = 0; i < remaining.length; i++) {
            const previousIndex = remaining[(i - 1 + remaining.length) % remaining.length]
            const currentIndex = remaining[i]
            const nextIndex = remaining[(i + 1) % remaining.length]
            const previous = points[previousIndex]
            const current = points[currentIndex]
            const next = points[nextIndex]

            if (orientation * triangleArea2(previous, current, next) <= polygonEpsilon) {
                continue
            }

            let containsPoint = false
            for (const index of remaining) {
                if (index === previousIndex || index === currentIndex || index === nextIndex) continue

                if (isPointInsideTriangle(points[index], previous, current, next, orientation)) {
                    containsPoint = true
                    break
                }
            }

            if (containsPoint) continue

            triangles.push(previousIndex, currentIndex, nextIndex)
            remaining.splice(i, 1)
            clipped = true
            break
        }

        if (!clipped) {
            return null
        }
    }

    if (remaining.length === 3) {
        triangles.push(remaining[0], remaining[1], remaining[2])
    }

    return new Int32Array(triangles)
}

function lerpColor(a: ColorRgba, b: ColorRgba, t: number): ColorRgba {
    return {
        r: a.r + (b.r - a.r) * t,
        g: a.g + (b.g - a.g) * t,
        b: a.b + (b.b - a.b) * t,
        a: a.a + (b.a - a.a) * t,
    }
}

function sampleGradient(stops: readonly LinearGradientStop[], t: number): ColorRgba {
    if (stops.length === 0) return { r: 0, g: 0, b: 0, a: 1 }
    if (stops.length === 1) return stops[0].color
    if (t <= stops[0].offset) return stops[0].color
    if (t >= stops[stops.length - 1].offset) return stops[stops.length - 1].color

    for (let i = 0; i < stops.length - 1; i++) {
        if (t >= stops[i].offset && t <= stops[i + 1].offset) {
            const range = stops[i + 1].offset - stops[i].offset
            const local = range > 0 ? (t - stops[i].offset) / range : 0
            return lerpColor(stops[i].color, stops[i + 1].color, local)
        }
    }

    return stops[stops.length - 1].color
}

function normalizeGradientStops(stops: readonly LinearGradientStop[]): LinearGradientStop[] {
    if (stops.length === 0) return []

    const ordered = stops
        .map((stop) => ({ offset: Math.max(0, Math.min(1, stop.offset)), color: stop.color }))
        .sort((left, right) => left.offset - right.offset)
    const normalized: LinearGradientStop[] = []
    const first = ordered[0]
    const last = ordered[ordered.length - 1]

    if (first.offset > 0) {
        normalized.push({ offset: 0, color: first.color })
    }

    normalized.push(...ordered)

    if (last.offset < 1) {
        normalized.push({ offset: 1, color: last.color })
    }

    return normalized
}

function mapBlendMode(mode: RendererBlendMode): number {
    switch (mode) {
        case 'replace':
            return SDL.BLENDMODE.NONE
        case 'alpha':
            return SDL.BLENDMODE.BLEND
        case 'add':
            return SDL.BLENDMODE.ADD
        case 'multiply':
            return SDL.BLENDMODE.MUL
    }
}

const logicalPresentationModes = {
    disabled: SDL.LOGICAL_PRESENTATION.DISABLED,
    stretch: SDL.LOGICAL_PRESENTATION.STRETCH,
    letterbox: SDL.LOGICAL_PRESENTATION.LETTERBOX,
    overscan: SDL.LOGICAL_PRESENTATION.OVERSCAN,
    'integer-scale': SDL.LOGICAL_PRESENTATION.INTEGER_SCALE,
} satisfies Record<SdlLogicalPresentationMode, number>

export class SdlRenderer implements Renderer2D {
    private readonly render: Render
    private readonly screenTarget: SdlRenderTargetEntry
    private readonly textures = new Map<string, SdlTextureEntry>()
    private readonly renderTargets = new Map<string, SdlRenderTargetEntry>()
    private readonly renderTargetTextureIds = new Set<string>()
    private currentRenderTarget: RenderTargetHandle | null = null
    private frameClearColor: ColorRgba = { r: 0, g: 0, b: 0, a: 1 }

    constructor(render: Render, width: number, height: number, options: SdlRendererOptions = {}) {
        this.render = render
        this.setLogicalPresentation(width, height, options.logicalPresentationMode ?? 'letterbox')
        this.screenTarget = this.createTargetTexture('__sdl_screen_backbuffer', width, height, SDL.BLENDMODE.NONE)
    }

    beginFrame(clearColor: ColorRgba): void {
        this.frameClearColor = clearColor
        assertSdl(this.render.setTarget(this.screenTarget.texture), 'SDL_SetRenderTarget failed for screen backbuffer')
        this.currentRenderTarget = null
        this.setDrawColor(clearColor)
        assertSdl(this.render.clear(), 'SDL_RenderClear failed')
    }

    endFrame(): void {
        if (this.currentRenderTarget) {
            this.setRenderTarget(null)
        }

        assertSdl(this.render.setTarget(null), 'SDL_SetRenderTarget failed for window')
        this.setDrawColor(this.frameClearColor)
        assertSdl(this.render.clear(), 'SDL_RenderClear failed')

        assertSdl(this.screenTarget.texture.setBlendMode(SDL.BLENDMODE.NONE), 'SDL_SetTextureBlendMode failed for screen backbuffer')
        assertSdl(this.screenTarget.texture.setAlphaMod(255), 'SDL_SetTextureAlphaMod failed for screen backbuffer')

        assertSdl(
            this.render.texture(
                this.screenTarget.texture,
                { x: 0, y: 0, w: this.screenTarget.handle.width, h: this.screenTarget.handle.height },
                { x: 0, y: 0, w: this.screenTarget.handle.width, h: this.screenTarget.handle.height },
            ),
            'SDL_RenderTexture failed for screen backbuffer',
        )
        assertSdl(this.render.present(), 'SDL_RenderPresent failed')
    }

    createRenderTarget(id: string, width: number, height: number): RenderTargetHandle {
        const existing = this.renderTargets.get(id)
        if (existing) {
            return existing.handle
        }

        const entry = this.createTargetTexture(id, width, height, SDL.BLENDMODE.BLEND)
        this.renderTargets.set(id, entry)
        this.textures.set(id, entry)
        this.renderTargetTextureIds.add(id)
        return entry.handle
    }

    setRenderTarget(target: RenderTargetHandle | null): void {
        const entry = target ? this.renderTargets.get(target.id) : null

        if (target && !entry) {
            throw new Error(`SDL render target '${target.id}' has not been created`)
        }

        assertSdl(
            this.render.setTarget(entry?.texture ?? this.screenTarget.texture),
            target ? `SDL_SetRenderTarget failed for '${target.id}'` : 'SDL_SetRenderTarget failed for screen backbuffer',
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

        if (options.blendMode) {
            assertSdl(entry.texture.setBlendMode(mapBlendMode(options.blendMode)), `SDL_SetTextureBlendMode failed for texture '${texture.id}'`)
        }

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

        if (options.blendMode) {
            assertSdl(entry.texture.setBlendMode(SDL.BLENDMODE.BLEND), `SDL_SetTextureBlendMode reset failed for texture '${texture.id}'`)
        }
    }

    clear(color: ColorRgba): void {
        this.setDrawColor(color)
        assertSdl(this.render.clear(), 'SDL_RenderClear failed')
    }

    drawRenderTarget(target: RenderTargetHandle, dest: Rect, blendMode: RendererBlendMode, alpha?: number): void {
        const entry = this.renderTargets.get(target.id)
        if (!entry) {
            throw new Error(`SDL render target '${target.id}' has not been created`)
        }

        assertSdl(entry.texture.setBlendMode(mapBlendMode(blendMode)), `SDL_SetTextureBlendMode failed for render target '${target.id}'`)
        assertSdl(entry.texture.setAlphaMod(alphaByte(alpha ?? 1)), `SDL_SetTextureAlphaMod failed for render target '${target.id}'`)

        const sourceRect = { x: 0, y: 0, w: target.width, h: target.height }
        const destRect = toSdlRect(dest)
        assertSdl(this.render.texture(entry.texture, sourceRect, destRect), `SDL_RenderTexture failed for render target '${target.id}'`)

        // Reset to default blend mode
        assertSdl(entry.texture.setBlendMode(SDL.BLENDMODE.BLEND), `SDL_SetTextureBlendMode reset failed for render target '${target.id}'`)
        assertSdl(entry.texture.setAlphaMod(255), `SDL_SetTextureAlphaMod reset failed for render target '${target.id}'`)
    }

    fillLinearGradientRect(rect: Rect, stops: readonly LinearGradientStop[], direction: LinearGradientDirection = 'vertical'): void {
        if (stops.length === 0) return

        if (stops.length === 1) {
            this.fillRect(rect, stops[0].color)
            return
        }

        if (direction === 'diagonal-down') {
            const topLeft = sampleGradient(stops, 0)
            const middle = sampleGradient(stops, 0.5)
            const bottomRight = sampleGradient(stops, 1)
            this.fillGradientQuad(rect, topLeft, middle, bottomRight, middle)
            return
        }

        const normalizedStops = normalizeGradientStops(stops)
        for (let i = 0; i < normalizedStops.length - 1; i++) {
            const top = normalizedStops[i]
            const bottom = normalizedStops[i + 1]
            if (bottom.offset <= top.offset) continue

            const y = rect.y + rect.height * top.offset
            const height = rect.height * (bottom.offset - top.offset)
            this.fillGradientQuad({ x: rect.x, y, width: rect.width, height }, top.color, top.color, bottom.color, bottom.color)
        }
    }

    fillRadialGradientFan(center: Vec2, radius: number, innerColor: ColorRgba, outerColor: ColorRgba, segments?: number): void {
        const seg = segments ?? 32
        if (seg < 3) return

        assertSdl(this.render.setDrawBlendMode(SDL.BLENDMODE.BLEND), 'SDL_SetRenderDrawBlendMode failed')

        const innerFColor = toSdlFColor(innerColor)
        const outerFColor = toSdlFColor(outerColor)

        const vertices = [
            { position: { x: center.x, y: center.y }, color: innerFColor, tex_coord: { x: 0, y: 0 } },
        ]

        for (let i = 0; i <= seg; i++) {
            const angle = (i / seg) * Math.PI * 2
            vertices.push({
                position: { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius },
                color: outerFColor,
                tex_coord: { x: 0, y: 0 },
            })
        }

        const indices = new Int32Array(seg * 3)
        for (let i = 0; i < seg; i++) {
            const offset = i * 3
            indices[offset] = 0
            indices[offset + 1] = i + 1
            indices[offset + 2] = i + 2
        }

        assertSdl(this.render.geometry(null, vertices, indices), 'SDL_RenderGeometry failed (radial gradient fan)')
    }

    fillRadialGradientEllipse(center: Vec2, radiusX: number, radiusY: number, innerColor: ColorRgba, outerColor: ColorRgba, segments?: number): void {
        const seg = segments ?? 32
        if (seg < 3) return

        assertSdl(this.render.setDrawBlendMode(SDL.BLENDMODE.BLEND), 'SDL_SetRenderDrawBlendMode failed')

        const innerFColor = toSdlFColor(innerColor)
        const outerFColor = toSdlFColor(outerColor)

        const vertices = [
            { position: { x: center.x, y: center.y }, color: innerFColor, tex_coord: { x: 0, y: 0 } },
        ]

        for (let i = 0; i <= seg; i++) {
            const angle = (i / seg) * Math.PI * 2
            vertices.push({
                position: { x: center.x + Math.cos(angle) * radiusX, y: center.y + Math.sin(angle) * radiusY },
                color: outerFColor,
                tex_coord: { x: 0, y: 0 },
            })
        }

        const indices = new Int32Array(seg * 3)
        for (let i = 0; i < seg; i++) {
            const offset = i * 3
            indices[offset] = 0
            indices[offset + 1] = i + 1
            indices[offset + 2] = i + 2
        }

        assertSdl(this.render.geometry(null, vertices, indices), 'SDL_RenderGeometry failed (radial gradient ellipse)')
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
        const polygonPoints = normalizePolygonPoints(points)
        const indices = triangulatePolygon(polygonPoints)
        if (!indices) return

        this.setDrawColor(color)
        const vertexColor = toSdlFColor(color)
        const vertices = polygonPoints.map((point) => ({
            position: { x: point.x, y: point.y },
            color: vertexColor,
            tex_coord: { x: 0, y: 0 },
        }))

        assertSdl(this.render.geometry(null, vertices, indices), 'SDL_RenderGeometry failed while drawing polygon')
    }

    fillTriangleFan(origin: Vec2, points: readonly Vec2[], color: ColorRgba): void {
        if (points.length < 2) return

        this.setDrawColor(color)
        const vertexColor = toSdlFColor(color)
        const vertices = [
            {
                position: { x: origin.x, y: origin.y },
                color: vertexColor,
                tex_coord: { x: 0, y: 0 },
            },
            ...points.map((point) => ({
                position: { x: point.x, y: point.y },
                color: vertexColor,
                tex_coord: { x: 0, y: 0 },
            })),
        ]
        const indices = new Int32Array(points.length * 3)

        for (let i = 0; i < points.length; i++) {
            const offset = i * 3
            indices[offset] = 0
            indices[offset + 1] = i + 1
            indices[offset + 2] = ((i + 1) % points.length) + 1
        }

        assertSdl(this.render.geometry(null, vertices, indices), 'SDL_RenderGeometry failed while drawing triangle fan')
    }

    dispose(): void {
        assertSdl(this.render.setTarget(null), 'SDL_SetRenderTarget failed for window')
        this.screenTarget.texture.destroy()

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

    private createTargetTexture(id: string, width: number, height: number, blendMode: number): SdlRenderTargetEntry {
        const texture = this.render.createTexture(SDL.PIXELFORMAT.RGBA8888, SDL.TEXTUREACCESS.TARGET, width, height)
        assertSdl(texture.setBlendMode(blendMode), `SDL_SetTextureBlendMode failed for render target '${id}'`)
        assertSdl(texture.setScaleMode(SDL.SCALEMODE.NEAREST), `SDL_SetTextureScaleMode failed for render target '${id}'`)

        return {
            handle: { id, width, height },
            texture,
        }
    }

    private fillGradientQuad(rect: Rect, topLeft: ColorRgba, topRight: ColorRgba, bottomRight: ColorRgba, bottomLeft: ColorRgba): void {
        assertSdl(this.render.setDrawBlendMode(SDL.BLENDMODE.BLEND), 'SDL_SetRenderDrawBlendMode failed')

        const vertices = [
            { position: { x: rect.x, y: rect.y }, color: toSdlFColor(topLeft), tex_coord: { x: 0, y: 0 } },
            { position: { x: rect.x + rect.width, y: rect.y }, color: toSdlFColor(topRight), tex_coord: { x: 0, y: 0 } },
            { position: { x: rect.x + rect.width, y: rect.y + rect.height }, color: toSdlFColor(bottomRight), tex_coord: { x: 0, y: 0 } },
            { position: { x: rect.x, y: rect.y + rect.height }, color: toSdlFColor(bottomLeft), tex_coord: { x: 0, y: 0 } },
        ]
        const indices = new Int32Array([0, 1, 2, 0, 2, 3])

        assertSdl(this.render.geometry(null, vertices, indices), 'SDL_RenderGeometry failed (linear gradient)')
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

    private setLogicalPresentation(width: number, height: number, mode: SdlLogicalPresentationMode): void {
        assertSdl(
            this.render.setLogicalPresentation(width, height, logicalPresentationModes[mode]),
            `SDL_SetRenderLogicalPresentation failed for ${width}x${height} ${mode}`,
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
