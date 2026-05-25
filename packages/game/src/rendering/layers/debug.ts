import type { Canvas2DPreviewRenderFrame, RenderLayer, RenderContext } from '@sidebound/engine'
import type { Rect, Vec2 } from '@sidebound/engine'
import type { RayHit } from '@sidebound/engine'

type LightDebugEntry = { polygon: RayHit[]; origin: Vec2; radius: number }

/**
 * Debug overlay layer: draws collision boxes, lighting rays, and radius.
 * Controlled by toggle flags exposed to the debug panel.
 */
export class DebugLayer implements RenderLayer {
    readonly order = 100

    showCollision = false
    showLighting = false

    private readonly solids: Rect[]
    private playerRectProvider: (() => Rect) | null = null
    private itemRectProvider: (() => Rect[]) | null = null
    private lightPolygonProvider: (() => LightDebugEntry[]) | null = null

    constructor(solids: Rect[]) {
        this.solids = solids
    }

    setPlayerRectProvider(provider: () => Rect): void {
        this.playerRectProvider = provider
    }

    setItemRectProvider(provider: () => Rect[]): void {
        this.itemRectProvider = provider
    }

    setLightPolygonProvider(provider: () => LightDebugEntry[]): void {
        this.lightPolygonProvider = provider
    }

    render(frame: Canvas2DPreviewRenderFrame): void {
        const { context } = frame

        if (this.showCollision) {
            this.drawCollision(context)
        }
        if (this.showLighting) {
            this.drawLightingDebug(context)
        }
    }

    private drawCollision(context: RenderContext): void {
        context.save()
        context.strokeStyle = 'rgba(255, 106, 106, 0.9)'
        context.lineWidth = 1

        for (const solid of this.solids) {
            context.strokeRect(solid.x + 0.5, solid.y + 0.5, solid.width - 1, solid.height - 1)
        }

        if (this.playerRectProvider) {
            const rect = this.playerRectProvider()
            context.strokeStyle = 'rgba(115, 255, 153, 0.9)'
            context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1)
        }

        if (this.itemRectProvider) {
            context.strokeStyle = 'rgba(246, 211, 101, 0.9)'
            for (const rect of this.itemRectProvider()) {
                context.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1)
            }
        }

        context.restore()
    }

    private drawLightingDebug(context: RenderContext): void {
        if (!this.lightPolygonProvider) return

        const entries = this.lightPolygonProvider()

        context.save()
        context.lineWidth = 1

        for (const { polygon, origin, radius } of entries) {
            // Rays
            context.strokeStyle = 'rgba(97, 210, 255, 0.28)'
            for (const hit of polygon) {
                context.beginPath()
                context.moveTo(origin.x, origin.y)
                context.lineTo(hit.x, hit.y)
                context.stroke()
            }

            // Radius circle
            context.strokeStyle = 'rgba(244, 196, 95, 0.65)'
            context.beginPath()
            context.arc(origin.x, origin.y, radius, 0, Math.PI * 2)
            context.stroke()
        }

        context.restore()
    }
}
