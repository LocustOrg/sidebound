import type { RenderLayer } from '../pipeline'
import type { Rect, Vec2 } from '../../core/geometry'
import type { RayHit } from '../../systems/lighting'
import { RayLighting } from '../../systems/lighting'

export type SunLight = {
    x: number
    y: number
    radius: number
}

/**
 * Lighting layer: renders darkness across the map with sun light sources
 * casting from the top. No player light — the world is dark except for
 * sun beams penetrating from above.
 */
export class LightingLayer implements RenderLayer {
    readonly order = 30

    private readonly lighting: RayLighting
    private readonly offscreen: HTMLCanvasElement
    private readonly offCtx: CanvasRenderingContext2D
    private readonly viewportWidth: number
    private readonly viewportHeight: number

    // Sun lights
    private sunLights: SunLight[] = []

    // Cached light data per sun (computed in update, used in render)
    private cachedSunResults: { polygon: RayHit[]; origin: Vec2; radius: number }[] = []

    // Legacy cached data for debug compatibility
    cachedPolygon: RayHit[] = []
    cachedOrigin: Vec2 = { x: 0, y: 0 }
    cachedRadius = 0

    // Diagnostics
    lastRayMs = 0
    lastRays = 0
    lastRayChecks = 0

    // Camera rect for culling — set externally via setCameraProvider or in render()
    private lastCamera: Rect = { x: 0, y: 0, width: 0, height: 0 }
    private cameraProvider: (() => Rect) | null = null

    constructor(lighting: RayLighting, viewportWidth: number, viewportHeight: number) {
        this.lighting = lighting
        this.viewportWidth = viewportWidth
        this.viewportHeight = viewportHeight

        this.offscreen = document.createElement('canvas')
        this.offscreen.width = viewportWidth
        this.offscreen.height = viewportHeight
        this.offCtx = this.offscreen.getContext('2d')!
    }

    /** Configure sun lights from above */
    setSunLights(lights: SunLight[]): void {
        this.sunLights = lights
    }

    /** Set a function that provides the current camera rect for viewport culling */
    setCameraProvider(provider: () => Rect): void {
        this.cameraProvider = provider
    }

    /** Ray-cast happens here (during update phase), not during render. */
    update(_deltaSeconds: number): void {
        // Get fresh camera position for culling
        if (this.cameraProvider) {
            this.lastCamera = this.cameraProvider()
        }

        const camera = this.lastCamera
        const start = performance.now()
        let totalRays = 0
        let totalChecks = 0

        this.cachedSunResults = []

        // Only cast rays for sun lights within/near the viewport
        const padding = 500
        for (const sun of this.sunLights) {
            if (
                sun.x + sun.radius < camera.x - padding ||
                sun.x - sun.radius > camera.x + camera.width + padding ||
                sun.y + sun.radius < camera.y - padding ||
                sun.y - sun.radius > camera.y + camera.height + padding
            ) {
                continue
            }

            const result = this.lighting.cast({ x: sun.x, y: sun.y }, sun.radius)
            totalRays += result.rays
            totalChecks += result.rayChecks
            this.cachedSunResults.push({
                polygon: result.polygon,
                origin: { x: sun.x, y: sun.y },
                radius: sun.radius,
            })
        }

        this.lastRayMs = performance.now() - start
        this.lastRays = totalRays
        this.lastRayChecks = totalChecks

        // Keep first result for debug panel compatibility
        if (this.cachedSunResults.length > 0) {
            this.cachedPolygon = this.cachedSunResults[0].polygon
            this.cachedOrigin = this.cachedSunResults[0].origin
            this.cachedRadius = this.cachedSunResults[0].radius
        }
    }

    get activeSunCount(): number {
        return this.cachedSunResults.length
    }

    get totalSunCount(): number {
        return this.sunLights.length
    }

    get activeSunData(): { polygon: RayHit[]; origin: Vec2; radius: number }[] {
        return this.cachedSunResults
    }

    render(context: CanvasRenderingContext2D, camera: Rect): void {
        this.lastCamera = camera

        if (this.cachedSunResults.length === 0) {
            // No active suns — just draw full darkness
            this.offCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight)
            this.offCtx.fillStyle = 'rgba(8, 6, 18, 0.82)'
            this.offCtx.fillRect(0, 0, this.viewportWidth, this.viewportHeight)
            context.save()
            context.translate(camera.x, camera.y)
            context.drawImage(this.offscreen, 0, 0)
            context.restore()
            return
        }

        // Draw darkness + light cutouts onto offscreen buffer
        this.offCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight)
        this.offCtx.save()
        this.offCtx.translate(-camera.x, -camera.y)

        // Full darkness
        this.offCtx.fillStyle = 'rgba(8, 6, 18, 0.82)'
        this.offCtx.fillRect(camera.x, camera.y, camera.width, camera.height)

        // Cut out each sun light
        this.offCtx.globalCompositeOperation = 'destination-out'
        for (const sun of this.cachedSunResults) {
            const gradient = this.offCtx.createRadialGradient(
                sun.origin.x, sun.origin.y, 4,
                sun.origin.x, sun.origin.y, sun.radius,
            )
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.98)')
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.6)')
            gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.25)')
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
            this.offCtx.fillStyle = gradient
            this.drawLightWedges(this.offCtx, sun.polygon, sun.origin)
        }
        this.offCtx.restore()

        // Composite offscreen darkness onto main context
        context.save()
        context.translate(camera.x, camera.y)
        context.drawImage(this.offscreen, 0, 0)
        context.restore()

        // Additive warm sun glow
        context.save()
        context.globalCompositeOperation = 'lighter'
        for (const sun of this.cachedSunResults) {
            const glow = context.createRadialGradient(
                sun.origin.x, sun.origin.y, 0,
                sun.origin.x, sun.origin.y, sun.radius,
            )
            glow.addColorStop(0, 'rgba(255, 240, 180, 0.18)')
            glow.addColorStop(0.6, 'rgba(255, 220, 120, 0.06)')
            glow.addColorStop(1, 'rgba(255, 200, 80, 0)')
            context.fillStyle = glow
            this.drawLightWedges(context, sun.polygon, sun.origin)
        }
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

