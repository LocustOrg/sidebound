import type { Rect, Vec2 } from '../core/mod.ts'

export type ColorRgba = {
    readonly r: number
    readonly g: number
    readonly b: number
    readonly a: number
}

export type RendererBlendMode = 'replace' | 'alpha' | 'add' | 'multiply'

type RendererImageSourceBase = {
    readonly width: number
    readonly height: number
}

export type RendererFileImageSource = RendererImageSourceBase & {
    readonly kind: 'file'
    readonly path: string
    readonly mimeType?: string
    readonly fileExtension?: string
}

export type RendererBytesImageSource = RendererImageSourceBase & {
    readonly kind: 'bytes'
    readonly bytes: Uint8Array<ArrayBuffer>
    readonly mimeType?: string
    readonly fileExtension?: string
}

export type RendererPlatformImageSource = RendererImageSourceBase & {
    readonly kind: 'platform'
    readonly source: unknown
}

export type RendererImageSource = RendererFileImageSource | RendererBytesImageSource | RendererPlatformImageSource

export type TextureHandle = {
    readonly id: string
    readonly width: number
    readonly height: number
}

export type RenderTargetHandle = {
    readonly id: string
    readonly width: number
    readonly height: number
}

export type DrawOptions = {
    readonly flipX?: boolean
    readonly alpha?: number
    readonly tint?: ColorRgba
    readonly blendMode?: RendererBlendMode
}

export type LinearGradientStop = {
    readonly offset: number
    readonly color: ColorRgba
}

export type Renderer2D = {
    beginFrame(clearColor: ColorRgba): void
    endFrame(): void

    createRenderTarget(id: string, width: number, height: number): RenderTargetHandle
    setRenderTarget(target: RenderTargetHandle | null): void

    loadTexture(id: string, source: RendererImageSource): Promise<TextureHandle>
    drawTexture(texture: TextureHandle, source: Rect, dest: Rect, options?: DrawOptions): void

    /** Clear the current render target (or screen) to a solid color. */
    clear(color: ColorRgba): void

    /** Draw a render target texture to the current target/screen with a specified blend mode. */
    drawRenderTarget(target: RenderTargetHandle, dest: Rect, blendMode: RendererBlendMode, alpha?: number): void

    /** Fill a rect with a vertical linear gradient defined by color stops. */
    fillLinearGradientRect(rect: Rect, stops: readonly LinearGradientStop[]): void

    /** Fill a radial gradient using a triangle fan from center outward. */
    fillRadialGradientFan(center: Vec2, radius: number, innerColor: ColorRgba, outerColor: ColorRgba, segments?: number): void

    /** Fill an elliptical radial gradient. */
    fillRadialGradientEllipse(center: Vec2, radiusX: number, radiusY: number, innerColor: ColorRgba, outerColor: ColorRgba, segments?: number): void

    fillRect(rect: Rect, color: ColorRgba): void
    strokeRect(rect: Rect, color: ColorRgba): void
    drawLine(from: Vec2, to: Vec2, color: ColorRgba): void
    drawPolygon(points: readonly Vec2[], color: ColorRgba): void
    fillTriangleFan(origin: Vec2, points: readonly Vec2[], color: ColorRgba): void
}

export type RenderFrame = {
    readonly renderer: Renderer2D
    readonly camera: Rect
}
