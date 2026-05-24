import type { ImageSource, RenderContext } from './render-context'

export type OffscreenSurface = {
    readonly context: RenderContext
    readonly image: ImageSource
    readonly width: number
    readonly height: number
}

export type PlatformAdapter = {
    loadImage(url: string): Promise<ImageSource>
    createOffscreenSurface(width: number, height: number): OffscreenSurface
}
