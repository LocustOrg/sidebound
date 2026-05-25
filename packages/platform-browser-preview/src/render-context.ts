import type { RenderContext } from '@sidebound/engine'

export function toRenderContext(context: CanvasRenderingContext2D): RenderContext {
    return context as unknown as RenderContext
}
