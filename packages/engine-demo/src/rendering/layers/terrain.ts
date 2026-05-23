import type { RenderLayer } from '../pipeline'
import type { Level } from '../../world/demo-map'
import type { Rect } from '../../core/geometry'

/**
 * Draws static solid geometry (platforms, walls) and reflector tiles.
 * Renders all solids with a top highlight and bottom shadow.
 * Reflectors are rendered as translucent glowing pillars.
 */
export class TerrainLayer implements RenderLayer {
    readonly order = 10
    private readonly solids: Rect[]
    private readonly reflectors: Rect[]

    constructor(world: Level) {
        this.solids = world.solids
        this.reflectors = world.reflectors
    }

    render(context: CanvasRenderingContext2D, _camera: Rect): void {
        // Draw solid terrain
        for (const solid of this.solids) {
            context.fillStyle = '#4e4668'
            context.fillRect(solid.x, solid.y, solid.width, solid.height)
            context.fillStyle = '#6e6488'
            context.fillRect(solid.x, solid.y, solid.width, 1)
            context.fillStyle = '#362f48'
            context.fillRect(solid.x, solid.y + solid.height - 1, solid.width, 1)
        }

        // Draw reflector tiles (translucent, glowing, player can pass through)
        context.save()
        context.globalAlpha = 0.45
        for (const ref of this.reflectors) {
            // Glowing crystal-like appearance
            const grad = context.createLinearGradient(ref.x, ref.y, ref.x + ref.width, ref.y + ref.height)
            grad.addColorStop(0, '#88ccff')
            grad.addColorStop(0.5, '#aaeeff')
            grad.addColorStop(1, '#6699dd')
            context.fillStyle = grad
            context.fillRect(ref.x, ref.y, ref.width, ref.height)

            // Bright edge highlight
            context.fillStyle = '#bbddff'
            context.fillRect(ref.x, ref.y, ref.width, 1)
            context.fillRect(ref.x, ref.y, 1, ref.height)
        }
        context.globalAlpha = 1.0
        context.restore()
    }
}
