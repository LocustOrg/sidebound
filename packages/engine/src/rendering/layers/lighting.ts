import type { Rect, Vec2 } from '../../core'
import type { RenderContext } from '../../platform/render-context'
import type { OffscreenSurface, PlatformAdapter } from '../../platform/adapter'
import { type LightSource, type RayHit, RayLighting } from '../../lighting'
import type { RenderLayer } from '../pipeline'

export type SunLight = {
    x: number
    y: number
    radius: number
}

export type LightDebugEntry = {
    polygon: RayHit[]
    origin: Vec2
    radius: number
}

type CachedLight = LightDebugEntry & {
    color: { r: number; g: number; b: number }
    intensity: number
}

export type LightingLayerOptions = {
    readonly platform: PlatformAdapter
    readonly ambientColor?: string
    readonly cullPadding?: number
}

export class LightingLayer implements RenderLayer {
    readonly order = 30

    private readonly lighting: RayLighting
    private readonly offscreen: OffscreenSurface
    private readonly offCtx: RenderContext
    private readonly viewportWidth: number
    private readonly viewportHeight: number
    private readonly ambientColor: string
    private readonly cullPadding: number
    private readonly sources: LightSource[] = []
    private cachedLights: CachedLight[] = []
    private lastCamera: Rect = { x: 0, y: 0, width: 0, height: 0 }
    private cameraProvider: (() => Rect) | null = null

    cachedPolygon: RayHit[] = []
    cachedOrigin: Vec2 = { x: 0, y: 0 }
    cachedRadius = 0
    lastRayMs = 0
    lastRays = 0
    lastRayChecks = 0

    constructor(lighting: RayLighting, viewportWidth: number, viewportHeight: number, options: LightingLayerOptions) {
        this.lighting = lighting
        this.viewportWidth = viewportWidth
        this.viewportHeight = viewportHeight
        this.ambientColor = options.ambientColor ?? 'rgba(8, 6, 18, 0.82)'
        this.cullPadding = options.cullPadding ?? 300

        this.offscreen = options.platform.createOffscreenSurface(viewportWidth, viewportHeight)
        this.offCtx = this.offscreen.context
        this.offCtx.imageSmoothingEnabled = false
    }

    addLight(source: LightSource): void {
        this.sources.push(source)
    }

    removeLight(source: LightSource): void {
        const index = this.sources.indexOf(source)

        if (index !== -1) {
            this.sources.splice(index, 1)
        }
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

    get activeSunData(): LightDebugEntry[] {
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

        for (const source of this.sources) {
            if (!source.isLightActive()) continue

            const pos = source.getPosition()
            const radius = source.getLightRadius()

            if (
                pos.x + radius < camera.x - this.cullPadding ||
                pos.x - radius > camera.x + camera.width + this.cullPadding ||
                pos.y + radius < camera.y - this.cullPadding ||
                pos.y - radius > camera.y + camera.height + this.cullPadding
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

    render(context: RenderContext, camera: Rect): void {
        this.lastCamera = camera
        this.offCtx.clearRect(0, 0, this.viewportWidth, this.viewportHeight)

        if (this.cachedLights.length === 0) {
            this.offCtx.fillStyle = this.ambientColor
            this.offCtx.fillRect(0, 0, this.viewportWidth, this.viewportHeight)
            context.save()
            context.translate(camera.x, camera.y)
            context.drawImage(this.offscreen.toImageSource(), 0, 0)
            context.restore()
            return
        }

        this.offCtx.save()
        this.offCtx.translate(-camera.x, -camera.y)
        this.offCtx.fillStyle = this.ambientColor
        this.offCtx.fillRect(camera.x, camera.y, camera.width, camera.height)
        this.offCtx.globalCompositeOperation = 'destination-out'

        for (const light of this.cachedLights) {
            const gradient = this.offCtx.createRadialGradient(light.origin.x, light.origin.y, 2, light.origin.x, light.origin.y, light.radius)
            const alpha = light.intensity

            gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
            gradient.addColorStop(0.4, `rgba(255, 255, 255, ${alpha * 0.7})`)
            gradient.addColorStop(0.7, `rgba(255, 255, 255, ${alpha * 0.3})`)
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
            this.offCtx.fillStyle = gradient
            this.drawLightWedges(this.offCtx, light.polygon, light.origin)
        }

        this.offCtx.restore()

        context.save()
        context.translate(camera.x, camera.y)
        context.drawImage(this.offscreen.toImageSource(), 0, 0)
        context.restore()

        context.save()
        context.globalCompositeOperation = 'lighter'

        for (const light of this.cachedLights) {
            const { r, g, b } = light.color
            const glow = context.createRadialGradient(light.origin.x, light.origin.y, 0, light.origin.x, light.origin.y, light.radius)

            glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${light.intensity * 0.2})`)
            glow.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${light.intensity * 0.06})`)
            glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
            context.fillStyle = glow
            this.drawLightWedges(context, light.polygon, light.origin)
        }

        context.restore()
    }

    private drawLightWedges(context: RenderContext, polygon: RayHit[], origin: Vec2): void {
        if (polygon.length < 2) return

        for (let index = 0; index < polygon.length; index += 1) {
            const next = (index + 1) % polygon.length

            context.beginPath()
            context.moveTo(origin.x, origin.y)
            context.lineTo(polygon[index].x, polygon[index].y)
            context.lineTo(polygon[next].x, polygon[next].y)
            context.closePath()
            context.fill()
        }
    }
}
