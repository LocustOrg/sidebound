import type { RenderLayer } from '../pipeline'
import type { Level } from '../../world/demo-map'
import type { Rect } from '../../core/geometry'

/**
 * Draws static solid geometry (platforms, walls).
 * Renders all solids with a top highlight and bottom shadow.
 */
export class TerrainLayer implements RenderLayer {
    readonly order = 10
    private readonly solids: Rect[]

    constructor(world: Level) {
        this.solids = world.solids
    }

    render(context: CanvasRenderingContext2D, _camera: Rect): void {
        for (const solid of this.solids) {
            context.fillStyle = '#4e4668'
            context.fillRect(solid.x, solid.y, solid.width, solid.height)
            context.fillStyle = '#6e6488'
            context.fillRect(solid.x, solid.y, solid.width, 1)
            context.fillStyle = '#362f48'
            context.fillRect(solid.x, solid.y + solid.height - 1, solid.width, 1)
        }
    }
}


