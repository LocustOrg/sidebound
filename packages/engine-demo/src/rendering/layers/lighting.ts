import type { RenderLayer } from '../pipeline'
import type { Rect, Vec2 } from '../../core/geometry'
import type { RayHit } from '../../systems/lighting'
import { RayLighting } from '../../systems/lighting'

/**
 * Lighting layer: caches the ray-cast result during update() and only
 * composites the light mask during render(). Uses an offscreen canvas
 * to avoid multiple composite-mode switches on the main context.
 */
export class LightingLayer implements RenderLayer {
    readonly order = 30

    private readonly lighting: RayLighting
    private readonly offscreen: HTMLCanvasElement
    private readonly offCtx: CanvasRenderingContext2D
    private readonly viewportWidth: number
    private readonly viewportHeight: number

    // Cached light data (computed in update, used in render)
    private cachedPolygon: RayHit[] = []
    private cachedOrigin: Vec2 = { x: 0, y: 0 }
    private cachedRadius = 0

    // Diagnostics
    lastRayMs = 0
    lastRays = 0
    lastRayChecks = 0

    // External reference to get origin + radius each frame
    private originProvider: (() => { origin: Vec2; radius: number }) | null = null

    constructor(lighting: RayLighting, viewportWidth: number, viewportHeight: number) {
        this.lighting = lighting
        this.viewportWidth = viewportWidth
        this.viewportHeight = viewportHeight

        this.offscreen = document.createElement('canvas')
        this.offscreen.width = viewportWidth
        this.offscreen.height = viewportHeight
        this.offCtx = this.offscreen.getContext('2d')!
    }

    /** Set the function that provides the light origin and radius each frame. */
    setOriginProvider(provider: () => { origin: Vec2; radius: number }): void {
        this.originProvider = provider
    }

    /** Ray-cast happens here (during update phase), not during render. */
    update(_deltaSeconds: number): void {
        if (!this.originProvider) return

        const { origin, radius } = this.originProvider()
        const start = performance.now()
        const result = this.lighting.cast(origin, radius)

        this.lastRayMs = performance.now() - start
        this.lastRays = result.rays
        this.lastRayChecks = result.rayChecks
        this.cachedPolygon = result.polygon
        this.cachedOrigin = origin
        this.cachedRadius = radius
    }

    render(context: CanvasRenderingContext2D, camera: Rect): void {
        if (this.cachedPolygon.length === 0) return

        const { cachedOrigin: origin, cachedRadius: radius, cachedPolygon: polygon } = this

        // Draw darkness + light cutout onto offscreen buffer
        this.offCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight)
        this.offCtx.save()
        this.offCtx.translate(-camera.x, -camera.y)

        // Darkness
        this.offCtx.fillStyle = 'rgba(10, 8, 22, 0.62)'
        this.offCtx.fillRect(camera.x, camera.y, camera.width, camera.height)

        // Cut out light polygon
        this.offCtx.globalCompositeOperation = 'destination-out'
        const gradient = this.offCtx.createRadialGradient(origin.x, origin.y, 3, origin.x, origin.y, radius)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
        gradient.addColorStop(0.62, 'rgba(255, 255, 255, 0.42)')
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
        this.offCtx.fillStyle = gradient
        this.drawLightWedges(this.offCtx, polygon, origin)
        this.offCtx.restore()

        // Composite offscreen darkness onto main context (single drawImage)
        context.save()
        context.translate(camera.x, camera.y)
        context.drawImage(this.offscreen, 0, 0)
        context.restore()

        // Additive warm glow
        context.save()
        context.globalCompositeOperation = 'lighter'
        const glow = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, radius)
        glow.addColorStop(0, 'rgba(244, 196, 95, 0.32)')
        glow.addColorStop(1, 'rgba(244, 196, 95, 0)')
        context.fillStyle = glow
        this.drawLightWedges(context, polygon, origin)
        context.restore()
    }

    private drawLightWedges(ctx: CanvasRenderingContext2D, polygon: RayHit[], origin: Vec2): void {
        if (polygon.length < 2) return

        for (let i = 0; i < polygon.length; i++) {
            const next = (i + 1) % polygon.length
            ctx.beginPath()
            ctx.moveTo(origin.x, origin.y)
            ctx.lineTo(polygon[i].x, polygon[i].y)
            ctx.lineTo(polygon[next].x, polygon[next].y)
            ctx.closePath()
            ctx.fill()
        }
    }
}



