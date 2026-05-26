import type { ColorRgba, LinearGradientStop, RenderFrame, RenderLayer } from '@sidebound/engine'
import type { Level } from '../../world/types.ts'

const gradientStops: readonly LinearGradientStop[] = [
    { offset: 0.0, color: { r: 52, g: 44, b: 78, a: 1 } },
    { offset: 0.35, color: { r: 38, g: 32, b: 62, a: 1 } },
    { offset: 0.7, color: { r: 28, g: 22, b: 48, a: 1 } },
    { offset: 1.0, color: { r: 18, g: 14, b: 34, a: 1 } },
]

const pillar: ColorRgba = { r: 56, g: 48, b: 80, a: 0.4 }
const panelEdge: ColorRgba = { r: 64, g: 56, b: 92, a: 0.3 }

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

        // Full-world vertical gradient background
        renderer.fillLinearGradientRect(
            { x: ox, y: oy, width, height },
            gradientStops,
        )

        // Subtle pillar accents for depth
        for (let x = 8; x < width; x += 32) {
            renderer.fillRect({ x: ox + x, y: oy + 24, width: 6, height: height - 48 }, pillar)
        }

        // Panel edge highlights on the top
        renderer.fillRect({ x: ox, y: oy, width, height: 2 }, panelEdge)
        renderer.fillRect({ x: ox, y: oy + height - 2, width, height: 2 }, panelEdge)
    }
}
