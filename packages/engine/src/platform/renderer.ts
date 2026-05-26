import type { Rect, Vec2 } from '../core/mod.ts'

export type ColorRgba = {
    readonly r: number
    readonly g: number
    readonly b: number
    readonly a: number
}

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
}

export type Renderer2D = {
    beginFrame(clearColor: ColorRgba): void
    endFrame(): void

    createRenderTarget(id: string, width: number, height: number): RenderTargetHandle
    setRenderTarget(target: RenderTargetHandle | null): void

    loadTexture(id: string, source: RendererImageSource): Promise<TextureHandle>
    drawTexture(texture: TextureHandle, source: Rect, dest: Rect, options?: DrawOptions): void

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
