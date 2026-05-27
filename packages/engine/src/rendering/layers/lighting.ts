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
    readonly shaftAlpha?: number
    readonly shaftRadiusMin?: number
    readonly localGlowAlpha?: number
    readonly localGlowColor?: ColorRgba
    readonly localGlowRadiusLimit?: number
}

export class LightingLayer implements RenderLayer {
    readonly order = 30

    private readonly lighting: RayLighting
    private viewportWidth: number
    private viewportHeight: number
    private readonly ambientColor: ColorRgba
    private readonly cullPadding: number
    private readonly shaftAlpha: number
    private readonly shaftRadiusMin: number
    private readonly localGlowAlpha: number
    private readonly localGlowColor: ColorRgba
    private readonly localGlowRadiusLimit: number
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
        this.ambientColor = options.ambientColor ?? { r: 6, g: 5, b: 16, a: 0.6 }
        this.cullPadding = options.cullPadding ?? 300
        this.shaftAlpha = options.shaftAlpha ?? 0.22
        this.shaftRadiusMin = options.shaftRadiusMin ?? 180
        this.localGlowAlpha = options.localGlowAlpha ?? 0.24
        this.localGlowColor = options.localGlowColor ?? { r: 168, g: 226, b: 255, a: 1 }
        this.localGlowRadiusLimit = options.localGlowRadiusLimit ?? 150
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

    resize(width: number, height: number): void {
        this.viewportWidth = width
        this.viewportHeight = height
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
        const { renderer, camera } = frame
        this.lastCamera = camera
        const ox = -camera.x
        const oy = -camera.y
        const viewRect = { x: 0, y: 0, width: this.viewportWidth, height: this.viewportHeight }

        renderer.fillRect(viewRect, this.ambientColor)

        for (const light of this.cachedLights) {
            const screenOrigin = { x: light.origin.x + ox, y: light.origin.y + oy }
            const screenPolygon = light.polygon.map((p) => ({ x: p.x + ox, y: p.y + oy }))

            if (light.radius >= this.shaftRadiusMin) {
                renderer.fillTriangleFan(screenOrigin, screenPolygon, {
                    r: light.color.r,
                    g: light.color.g,
                    b: light.color.b,
                    a: light.intensity * this.shaftAlpha,
                })
            }

            if (light.radius <= this.localGlowRadiusLimit && this.localGlowAlpha > 0) {
                const innerColor = { ...this.localGlowColor, a: this.localGlowAlpha * light.intensity }
                renderer.fillRadialGradientFan(
                    screenOrigin,
                    light.radius,
                    innerColor,
                    { ...innerColor, a: 0 },
                    32,
                )
            }
        }
    }
}
