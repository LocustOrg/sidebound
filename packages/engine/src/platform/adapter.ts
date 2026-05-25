import type { ImageSource, RenderContext } from './render-context'

export type Canvas2DPreviewSurface = {
    readonly context: RenderContext
    readonly image: ImageSource
    readonly width: number
    readonly height: number
}

export type Canvas2DPreviewPlatform = {
    loadImage(url: string): Promise<ImageSource>
    createOffscreenSurface(width: number, height: number): Canvas2DPreviewSurface
}
