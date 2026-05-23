import type { RenderLayer } from '../pipeline'
import type { Level } from '../../world/demo-map'
import type { Rect } from '../../core/geometry'

/**
 * Draws the static world background: gradient sky and decorative vertical lines.
 * Only redraws when the camera moves (compares previous camera rect).
 */
export class BackgroundLayer implements RenderLayer {
    readonly order = 0
    private readonly world: Level

    constructor(world: Level) {
        this.world = world
    }

    render(context: CanvasRenderingContext2D, _camera: Rect): void {
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
    }
}


