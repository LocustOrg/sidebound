import type { RenderLayer } from '../pipeline'
import type { Rect, Vec2 } from '../../core/geometry'
import type { RayHit } from '../../systems/lighting'
import type { LightSource } from '../../world/types'
import { RayLighting } from '../../systems/lighting'
import { PointLight } from '../../systems/light-source'

export type SunLight = {
    x: number
    y: number
    radius: number
}

type CachedLight = {
    polygon: RayHit[]
    origin: Vec2
    radius: number
    color: { r: number; g: number; b: number }
    intensity: number
}

export class LightingLayer implements RenderLayer {
    readonly order = 30

    private readonly lighting: RayLighting
    private readonly offscreen: HTMLCanvasElement
    private readonly offCtx: CanvasRenderingContext2D
    private readonly viewportWidth: number
    private readonly viewportHeight: number

    private readonly sources: LightSource[] = []
    private cachedLights: CachedLight[] = []

    cachedPolygon: RayHit[] = []
    cachedOrigin: Vec2 = { x: 0, y: 0 }
    cachedRadius = 0

    lastRayMs = 0
    lastRays = 0
    lastRayChecks = 0

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

    addLight(source: LightSource): void {
        this.sources.push(source)
    }

    setSunLights(lights: SunLight[]): void {
        this.sources.length = 0
        for (const light of lights) {
            this.sources.push(new PointLight({
                position: { x: light.x, y: light.y },
                radius: light.radius,
            }))
        }
    }

    removeLight(source: LightSource): void {
        const idx = this.sources.indexOf(source)
        if (idx !== -1) this.sources.splice(idx, 1)
    }

    setCameraProvider(provider: () => Rect): void {
        this.cameraProvider = provider
    }

    get activeSunCount(): number {
        return this.cachedLights.length
    }

    get totalSunCount(): number {
        return this.sources.length
    }

    get activeSunData(): { polygon: RayHit[]; origin: Vec2; radius: number }[] {
        return this.cachedLights
    }

    update(_deltaSeconds: number): void {
        if (this.cameraProvider) {
            this.lastCamera = this.cameraProvider()
        }

        const camera = this.lastCamera
        const start = performance.now()
        let totalRays = 0
        let totalChecks = 0

        this.cachedLights = []

        const padding = 500
        for (const source of this.sources) {
            if (!source.isLightActive()) continue

            const pos = source.getPosition()
            const radius = source.getLightRadius()

            if (
                pos.x + radius < camera.x - padding ||
                pos.x - radius > camera.x + camera.width + padding ||
                pos.y + radius < camera.y - padding ||
                pos.y - radius > camera.y + camera.height + padding
            ) {
                continue
            }

            const result = this.lighting.cast(pos, radius)
            totalRays += result.rays
            totalChecks += result.rayChecks
            this.cachedLights.push({
                polygon: result.polygon,
                origin: pos,
                radius,
                color: source.getLightColor(),
                intensity: source.getLightIntensity(),
            })
        }

        this.lastRayMs = performance.now() - start
        this.lastRays = totalRays
        this.lastRayChecks = totalChecks

        if (this.cachedLights.length > 0) {
            this.cachedPolygon = this.cachedLights[0].polygon
            this.cachedOrigin = this.cachedLights[0].origin
            this.cachedRadius = this.cachedLights[0].radius
        }
    }

    render(context: CanvasRenderingContext2D, camera: Rect): void {
        this.lastCamera = camera

        if (this.cachedLights.length === 0) {
            this.offCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight)
            this.offCtx.fillStyle = 'rgba(8, 6, 18, 0.82)'
            this.offCtx.fillRect(0, 0, this.viewportWidth, this.viewportHeight)
            context.save()
            context.translate(camera.x, camera.y)
            context.drawImage(this.offscreen, 0, 0)
            context.restore()
            return
        }

        this.offCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight)
        this.offCtx.save()
        this.offCtx.translate(-camera.x, -camera.y)

        this.offCtx.fillStyle = 'rgba(8, 6, 18, 0.82)'
        this.offCtx.fillRect(camera.x, camera.y, camera.width, camera.height)

        this.offCtx.globalCompositeOperation = 'destination-out'
        for (const light of this.cachedLights) {
            const gradient = this.offCtx.createRadialGradient(
                light.origin.x, light.origin.y, 2,
                light.origin.x, light.origin.y, light.radius,
            )
            const a = light.intensity
            gradient.addColorStop(0, `rgba(255, 255, 255, ${a})`)
            gradient.addColorStop(0.4, `rgba(255, 255, 255, ${a * 0.7})`)
            gradient.addColorStop(0.7, `rgba(255, 255, 255, ${a * 0.3})`)
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
            this.offCtx.fillStyle = gradient
            this.drawLightWedges(this.offCtx, light.polygon, light.origin)
        }
        this.offCtx.restore()

        context.save()
        context.translate(camera.x, camera.y)
        context.drawImage(this.offscreen, 0, 0)
        context.restore()

        context.save()
        context.globalCompositeOperation = 'lighter'
        for (const light of this.cachedLights) {
            const { r, g, b } = light.color
            const glow = context.createRadialGradient(
                light.origin.x, light.origin.y, 0,
                light.origin.x, light.origin.y, light.radius,
            )
            glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${light.intensity * 0.2})`)
            glow.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${light.intensity * 0.06})`)
            glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
            context.fillStyle = glow
            this.drawLightWedges(context, light.polygon, light.origin)
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
