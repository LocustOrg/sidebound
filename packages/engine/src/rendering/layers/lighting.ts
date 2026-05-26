import type { Rect, Vec2 } from '../../core/mod.ts'
import type { ColorRgba, RenderFrame } from '../../platform/renderer.ts'
import type { LightSource, RayHit, RayLighting } from '../../lighting/mod.ts'
import type { RenderLayer } from '../pipeline.ts'

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
    readonly ambientColor?: ColorRgba
    readonly cullPadding?: number
}

export class LightingLayer implements RenderLayer {
    readonly order = 30

    private readonly lighting: RayLighting
    private readonly viewportWidth: number
    private readonly viewportHeight: number
    private readonly ambientColor: ColorRgba
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
        this.ambientColor = options.ambientColor ?? { r: 8, g: 6, b: 18, a: 0.82 }
        this.cullPadding = options.cullPadding ?? 300
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

    render(frame: RenderFrame): void {
        const { camera } = frame
        this.lastCamera = camera
        const viewRect = { x: camera.x, y: camera.y, width: this.viewportWidth, height: this.viewportHeight }

        if (this.cachedLights.length === 0) {
            frame.renderer.fillRect(viewRect, this.ambientColor)
            return
        }

        frame.renderer.fillRect(viewRect, this.ambientColor)

        for (const light of this.cachedLights) {
            frame.renderer.drawPolygon(light.polygon, {
                r: light.color.r,
                g: light.color.g,
                b: light.color.b,
                a: light.intensity * 0.16,
            })
        }
    }
}
