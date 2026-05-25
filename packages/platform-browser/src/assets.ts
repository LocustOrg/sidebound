import type { Canvas2DPreviewPlatform, Canvas2DPreviewSurface, ImageSource } from '@sidebound/engine'
import { toRenderContext } from './render-context.ts'

export class BrowserPlatformAdapter implements Canvas2DPreviewPlatform {
    loadImage(url: string): Promise<ImageSource> {
        return new Promise((resolve, reject) => {
            const image = new Image()
            image.onload = () => resolve(image)
            image.onerror = () => reject(new Error(`Failed to load image from ${url}`))
            image.src = url
        })
    }

    createOffscreenSurface(width: number, height: number): Canvas2DPreviewSurface {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')

        if (!ctx) {
            throw new Error('Failed to create offscreen canvas context')
        }

        ctx.imageSmoothingEnabled = false

        return {
            context: toRenderContext(ctx),
            image: canvas,
            width,
            height,
        }
    }
}
