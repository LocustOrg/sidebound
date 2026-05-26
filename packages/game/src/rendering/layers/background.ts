import type { ColorRgba, RenderFrame, RenderLayer } from '@sidebound/engine'
import type { Level } from '../../world/types.ts'

const bgTop: ColorRgba = { r: 42, g: 36, b: 64, a: 1 }
const bgBottom: ColorRgba = { r: 22, g: 18, b: 40, a: 1 }
const stripe: ColorRgba = { r: 48, g: 40, b: 72, a: 1 }
const pillar: ColorRgba = { r: 61, g: 51, b: 88, a: 1 }

/**
 * Background layer. Uses solid color bands instead of gradients
 * for SDL3 parity. Gradient version is omitted temporarily.
 */
export class BackgroundLayer implements RenderLayer {
    readonly order = 0
    private readonly world: Level

    constructor(world: Level) {
        this.world = world
    }

    render(frame: RenderFrame): void {
        const { renderer } = frame
        const { width, height } = this.world

        // Two-band background approximating the old gradient
        const halfHeight = Math.round(height / 2)
        renderer.fillRect({ x: 0, y: 0, width, height: halfHeight }, bgTop)
        renderer.fillRect({ x: 0, y: halfHeight, width, height: height - halfHeight }, bgBottom)

        // Vertical stripes
        for (let x = 0; x < width; x += 16) {
            renderer.fillRect({ x, y: 0, width: 2, height }, stripe)
        }

        // Pillar accents
        for (let x = 8; x < width; x += 32) {
            renderer.fillRect({ x, y: 24, width: 8, height: 106 }, pillar)
        }
    }
}
