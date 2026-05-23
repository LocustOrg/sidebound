import type { RenderLayer } from '../pipeline'
import type { Level } from '../../world/demo-map'
import type { Rect } from '../../core/geometry'
import type { SunLight } from './lighting'

/**
 * Draws the static world background: gradient sky, decorative lines, and sun orbs.
 */
export class BackgroundLayer implements RenderLayer {
    readonly order = 0
    private readonly world: Level
    private sunLights: SunLight[] = []

    constructor(world: Level) {
        this.world = world
    }

    setSunLights(lights: SunLight[]): void {
        this.sunLights = lights
    }

    render(context: CanvasRenderingContext2D, camera: Rect): void {
        const { width, height } = this.world

        const gradient = context.createLinearGradient(0, 0, 0, height)
        gradient.addColorStop(0, '#2a2440')
        gradient.addColorStop(1, '#161228')
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)

        // Decorative vertical lines
        context.fillStyle = '#302848'
        for (let x = 0; x < width; x += 16) {
            context.fillRect(x, 0, 2, height)
        }

        // Taller decorative columns
        context.fillStyle = '#3d3358'
        for (let x = 8; x < width; x += 32) {
            context.fillRect(x, 24, 8, 106)
        }

        // Draw sun orbs (visible glowing circles at each sun position)
        for (const sun of this.sunLights) {
            // Only render suns near the camera viewport
            if (sun.x + 40 < camera.x || sun.x - 40 > camera.x + camera.width || sun.y + 40 < camera.y || sun.y - 40 > camera.y + camera.height) {
                continue
            }

            // Outer glow
            const glow = context.createRadialGradient(sun.x, sun.y, 2, sun.x, sun.y, 32)
            glow.addColorStop(0, 'rgba(255, 240, 160, 0.6)')
            glow.addColorStop(0.4, 'rgba(255, 200, 80, 0.2)')
            glow.addColorStop(1, 'rgba(255, 180, 60, 0)')
            context.fillStyle = glow
            context.beginPath()
            context.arc(sun.x, sun.y, 32, 0, Math.PI * 2)
            context.fill()

            // Bright core
            context.fillStyle = 'rgba(255, 250, 200, 0.9)'
            context.beginPath()
            context.arc(sun.x, sun.y, 4, 0, Math.PI * 2)
            context.fill()
        }
    }
}
