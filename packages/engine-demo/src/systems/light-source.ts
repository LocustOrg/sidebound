import type { Vec2 } from '../core/geometry'
import type { LightSource } from '../world/types'

export class PointLight implements LightSource {
    private position: Vec2
    private radius: number
    private color: { r: number; g: number; b: number }
    private intensity: number
    private active: boolean

    constructor(options: {
        position: Vec2
        radius: number
        color?: { r: number; g: number; b: number }
        intensity?: number
        active?: boolean
    }) {
        this.position = { ...options.position }
        this.radius = options.radius
        this.color = options.color ?? { r: 255, g: 240, b: 180 }
        this.intensity = options.intensity ?? 0.9
        this.active = options.active ?? true
    }

    getPosition(): Vec2 {
        return this.position
    }

    getLightRadius(): number {
        return this.radius
    }

    getLightColor(): { r: number; g: number; b: number } {
        return this.color
    }

    getLightIntensity(): number {
        return this.intensity
    }

    isLightActive(): boolean {
        return this.active
    }

    setPosition(pos: Vec2): void {
        this.position = pos
    }

    setRadius(radius: number): void {
        this.radius = radius
    }

    setColor(color: { r: number; g: number; b: number }): void {
        this.color = color
    }

    setIntensity(intensity: number): void {
        this.intensity = intensity
    }

    setActive(active: boolean): void {
        this.active = active
    }
}

export class AttachedLight implements LightSource {
    private readonly positionProvider: () => Vec2
    private radius: number
    private color: { r: number; g: number; b: number }
    private intensity: number
    private active: boolean

    constructor(options: {
        positionProvider: () => Vec2
        radius: number
        color?: { r: number; g: number; b: number }
        intensity?: number
        active?: boolean
    }) {
        this.positionProvider = options.positionProvider
        this.radius = options.radius
        this.color = options.color ?? { r: 200, g: 220, b: 255 }
        this.intensity = options.intensity ?? 0.9
        this.active = options.active ?? true
    }

    getPosition(): Vec2 {
        return this.positionProvider()
    }

    getLightRadius(): number {
        return this.radius
    }

    getLightColor(): { r: number; g: number; b: number } {
        return this.color
    }

    getLightIntensity(): number {
        return this.intensity
    }

    isLightActive(): boolean {
        return this.active
    }

    setRadius(radius: number): void {
        this.radius = radius
    }

    setColor(color: { r: number; g: number; b: number }): void {
        this.color = color
    }

    setIntensity(intensity: number): void {
        this.intensity = intensity
    }

    setActive(active: boolean): void {
        this.active = active
    }
}

