import type { Rect, Vec2 } from '../../core/mod.ts'
import type { ColorRgba, RenderFrame, RenderTargetHandle } from '../../platform/renderer.ts'
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
    readonly hazeAlpha?: number
    readonly hazeColor?: ColorRgba
}

export class LightingLayer implements RenderLayer {
    readonly order = 15

    private readonly lighting: RayLighting
    private viewportWidth: number
    private viewportHeight: number
    private readonly ambientColor: ColorRgba
    private readonly cullPadding: number
    private readonly hazeAlpha: number
    private readonly hazeColor: ColorRgba
    private readonly sources: LightSource[] = []
    private cachedLights: CachedLight[] = []
    private lastCamera: Rect = { x: 0, y: 0, width: 0, height: 0 }
    private cameraProvider: (() => Rect) | null = null
    private lightBuffer: RenderTargetHandle | null = null

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
        // Brighter ambient: purple-tinted but lighter than before
        this.ambientColor = options.ambientColor ?? { r: 38, g: 32, b: 58, a: 0.68 }
        this.cullPadding = options.cullPadding ?? 300
        this.hazeAlpha = options.hazeAlpha ?? 0.06
        this.hazeColor = options.hazeColor ?? { r: 140, g: 120, b: 200, a: 0.06 }
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
        this.lightBuffer = null // force re-create
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

        // Ensure light buffer exists
        if (!this.lightBuffer) {
            this.lightBuffer = renderer.createRenderTarget('__lighting_buffer', this.viewportWidth, this.viewportHeight)
        }

        // === Pass 1: Render light mask into the buffer ===
        renderer.setRenderTarget(this.lightBuffer)
        // Clear to ambient multiplier color (white = fully lit, darker = dimmer)
        // We use a multiply blend later, so the ambient tint defines the darkest areas
        renderer.clear(this.ambientColor)

        // Draw light polygons as bright (white-ish) areas that lighten the ambient
        for (const light of this.cachedLights) {
            const screenOrigin = { x: light.origin.x + ox, y: light.origin.y + oy }
            const screenPolygon = light.polygon.map((p) => ({ x: p.x + ox, y: p.y + oy }))

            // Inner color: bright tinted by the light color, outer color: transparent
            const innerColor: ColorRgba = {
                r: light.color.r,
                g: light.color.g,
                b: light.color.b,
                a: light.intensity * 0.55,
            }

            // Draw radial falloff fan for the light
            renderer.fillRadialGradientFan(screenOrigin, light.radius, innerColor, { ...innerColor, a: 0 }, 48)

            // Also draw the hard polygon shape with partial alpha for crisp light edges
            renderer.fillTriangleFan(screenOrigin, screenPolygon, {
                r: light.color.r,
                g: light.color.g,
                b: light.color.b,
                a: light.intensity * 0.18,
            })
        }

        // === Pass 2: Composite the light buffer over the scene with multiply ===
        renderer.setRenderTarget(null)
        renderer.drawRenderTarget(this.lightBuffer, viewRect, 'multiply')

        // === Pass 3: Subtle additive haze (simulates ambient light shafts) ===
        if (this.hazeAlpha > 0 && this.cachedLights.length > 0) {
            // Draw soft diagonal light shaft hints as additive rects
            for (const light of this.cachedLights) {
                const sx = light.origin.x + ox
                const sy = light.origin.y + oy

                // Only draw shafts for lights visible on screen 
                if (sx < -light.radius || sx > this.viewportWidth + light.radius) continue
                if (sy < -light.radius || sy > this.viewportHeight + light.radius) continue

                renderer.fillRadialGradientFan(
                    { x: sx, y: sy },
                    light.radius * 0.6,
                    { r: this.hazeColor.r, g: this.hazeColor.g, b: this.hazeColor.b, a: this.hazeAlpha * light.intensity },
                    { r: this.hazeColor.r, g: this.hazeColor.g, b: this.hazeColor.b, a: 0 },
                    24,
                )
            }
        }
    }
}
