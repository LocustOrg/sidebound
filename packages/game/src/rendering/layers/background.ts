import type { ColorRgba, LinearGradientStop, RenderFrame, RenderLayer } from '@sidebound/engine'
import type { Level } from '../../world/types.ts'

const gradientStops: readonly LinearGradientStop[] = [
    { offset: 0, color: { r: 42, g: 36, b: 64, a: 1 } },
    { offset: 1, color: { r: 22, g: 18, b: 40, a: 1 } },
]

const stripe: ColorRgba = { r: 48, g: 40, b: 72, a: 1 }
const pillar: ColorRgba = { r: 61, g: 51, b: 88, a: 1 }

/**
 * Background layer. Renders a vertical gradient with subtle panel accents
 * to match the browser reference screenshots' ambient depth.
 */
export class BackgroundLayer implements RenderLayer {
    readonly order = 0
    private readonly world: Level

    constructor(world: Level) {
        this.world = world
    }

    render(frame: RenderFrame): void {
        const { renderer, camera } = frame
        const { width, height } = this.world
        const ox = -camera.x
        const oy = -camera.y

        renderer.fillLinearGradientRect(
            { x: ox, y: oy, width, height },
            gradientStops,
        )

        for (let x = 0; x < width; x += 16) {
            renderer.fillRect({ x: ox + x, y: oy, width: 2, height }, stripe)
        }

        for (let x = 8; x < width; x += 32) {
            renderer.fillRect({ x: ox + x, y: oy + 24, width: 8, height: 106 }, pillar)
        }
    }
}
