import type { RenderLayer, RenderContext } from '@sidebound/engine'
import type { Level } from '../../world/types'
import type { Rect } from '@sidebound/engine'

export class BackgroundLayer implements RenderLayer {
    readonly order = 0
    private readonly world: Level

    constructor(world: Level) {
        this.world = world
    }

    render(context: RenderContext, _camera: Rect): void {
        const { width, height } = this.world

        const gradient = context.createLinearGradient(0, 0, 0, height)
        gradient.addColorStop(0, '#2a2440')
        gradient.addColorStop(1, '#161228')
        context.fillStyle = gradient
        context.fillRect(0, 0, width, height)

        context.fillStyle = '#302848'
        for (let x = 0; x < width; x += 16) {
            context.fillRect(x, 0, 2, height)
        }

        context.fillStyle = '#3d3358'
        for (let x = 8; x < width; x += 32) {
            context.fillRect(x, 24, 8, 106)
        }
    }
}
