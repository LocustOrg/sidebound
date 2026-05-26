import type { ColorRgba, RayHit, Rect, Renderer2D, RenderFrame, RenderLayer, Vec2 } from '@sidebound/engine'

type LightDebugEntry = { polygon: RayHit[]; origin: Vec2; radius: number }

const solidColor: ColorRgba = { r: 255, g: 106, b: 106, a: 0.9 }
const playerColor: ColorRgba = { r: 115, g: 255, b: 153, a: 0.9 }
const itemColor: ColorRgba = { r: 246, g: 211, b: 101, a: 0.9 }
const rayColor: ColorRgba = { r: 97, g: 210, b: 255, a: 0.28 }
const radiusColor: ColorRgba = { r: 244, g: 196, b: 95, a: 0.65 }

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

    render(frame: RenderFrame): void {
        const { renderer, camera } = frame
        const ox = -camera.x
        const oy = -camera.y

        if (this.showCollision) {
            this.drawCollision(renderer, ox, oy)
        }
        if (this.showLighting) {
            this.drawLightingDebug(renderer, ox, oy)
        }
    }

    private drawCollision(renderer: Renderer2D, ox: number, oy: number): void {
        for (const solid of this.solids) {
            renderer.strokeRect({ x: solid.x + ox, y: solid.y + oy, width: solid.width, height: solid.height }, solidColor)
        }

        if (this.playerRectProvider) {
            const pr = this.playerRectProvider()
            renderer.strokeRect({ x: pr.x + ox, y: pr.y + oy, width: pr.width, height: pr.height }, playerColor)
        }

        if (this.itemRectProvider) {
            for (const rect of this.itemRectProvider()) {
                renderer.strokeRect({ x: rect.x + ox, y: rect.y + oy, width: rect.width, height: rect.height }, itemColor)
            }
        }
    }

    private drawLightingDebug(renderer: Renderer2D, ox: number, oy: number): void {
        if (!this.lightPolygonProvider) return

        const entries = this.lightPolygonProvider()

        for (const { polygon, origin, radius } of entries) {
            // Rays
            const screenOrigin = { x: origin.x + ox, y: origin.y + oy }
            for (const hit of polygon) {
                renderer.drawLine(screenOrigin, { x: hit.x + ox, y: hit.y + oy }, rayColor)
            }

            // Radius circle approximated as polygon
            const segments = 32
            const points: Vec2[] = []
            for (let i = 0; i < segments; i++) {
                const angle = (i / segments) * Math.PI * 2
                points.push({
                    x: origin.x + Math.cos(angle) * radius + ox,
                    y: origin.y + Math.sin(angle) * radius + oy,
                })
            }
            renderer.drawPolygon(points, radiusColor)
        }
    }
}
