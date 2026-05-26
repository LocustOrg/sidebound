import type { ColorRgba, Renderer2D, RenderFrame, RenderLayer } from '@sidebound/engine'
import type { Level, PlacedTile } from '../../world/types.ts'

const wallColor: ColorRgba = { r: 78, g: 70, b: 104, a: 1 }
const wallHighlight: ColorRgba = { r: 110, g: 100, b: 136, a: 1 }
const wallShadow: ColorRgba = { r: 54, g: 47, b: 72, a: 1 }
const glassColor: ColorRgba = { r: 136, g: 204, b: 255, a: 0.55 }
const glassHighlight: ColorRgba = { r: 215, g: 246, b: 255, a: 0.85 }
const decorColor: ColorRgba = { r: 123, g: 208, b: 177, a: 1 }
const decorBright: ColorRgba = { r: 181, g: 246, b: 217, a: 1 }
const grateBackground: ColorRgba = { r: 40, g: 34, b: 47, a: 1 }
const grateBar: ColorRgba = { r: 159, g: 140, b: 114, a: 1 }
const grateHighlight: ColorRgba = { r: 215, g: 183, b: 124, a: 1 }

export class TerrainLayer implements RenderLayer {
    readonly order = 10
    private readonly tiles: PlacedTile[]

    constructor(world: Level) {
        this.tiles = world.tiles
    }

    render(frame: RenderFrame): void {
        const { renderer, camera } = frame
        const ox = -camera.x
        const oy = -camera.y

        for (const tile of this.tiles) {
            // Cull tiles outside the viewport
            if (
                tile.x + tile.width < camera.x ||
                tile.x > camera.x + camera.width ||
                tile.y + tile.height < camera.y ||
                tile.y > camera.y + camera.height
            ) continue

            const screenTile = { x: tile.x + ox, y: tile.y + oy, width: tile.width, height: tile.height, material: tile.material, glyph: tile.glyph }

            switch (tile.material) {
                case 'wall':
                    this.drawWall(renderer, screenTile)
                    break
                case 'glass':
                    this.drawGlass(renderer, screenTile)
                    break
                case 'decor':
                    this.drawDecor(renderer, screenTile)
                    break
                case 'grate':
                    this.drawGrate(renderer, screenTile)
                    break
            }
        }
    }

    private drawWall(renderer: Renderer2D, tile: PlacedTile): void {
        renderer.fillRect({ x: tile.x, y: tile.y, width: tile.width, height: tile.height }, wallColor)
        renderer.fillRect({ x: tile.x, y: tile.y, width: tile.width, height: 1 }, wallHighlight)
        renderer.fillRect({ x: tile.x, y: tile.y + tile.height - 1, width: tile.width, height: 1 }, wallShadow)
    }

    private drawGlass(renderer: Renderer2D, tile: PlacedTile): void {
        renderer.fillRect({ x: tile.x, y: tile.y, width: tile.width, height: tile.height }, glassColor)
        renderer.fillRect({ x: tile.x + 4, y: tile.y + 4, width: tile.width - 8, height: 2 }, glassHighlight)
        renderer.fillRect({ x: tile.x + 4, y: tile.y + 4, width: 2, height: tile.height - 8 }, glassHighlight)
    }

    private drawDecor(renderer: Renderer2D, tile: PlacedTile): void {
        const cx = tile.x + Math.floor(tile.width / 2)
        const cy = tile.y + Math.floor(tile.height / 2)

        renderer.fillRect({ x: cx - 1, y: cy - 1, width: 3, height: 3 }, decorColor)
        renderer.fillRect({ x: cx, y: cy - 5, width: 1, height: 11 }, decorBright)
        renderer.fillRect({ x: cx - 5, y: cy, width: 11, height: 1 }, decorBright)
    }

    private drawGrate(renderer: Renderer2D, tile: PlacedTile): void {
        const bar = Math.max(2, Math.round(tile.width * 0.12))
        const inset = Math.max(3, Math.round(tile.width * 0.16))
        const center = tile.x + Math.floor((tile.width - bar) / 2)
        const far = tile.x + tile.width - inset - bar

        renderer.fillRect({ x: tile.x, y: tile.y, width: tile.width, height: tile.height }, grateBackground)
        renderer.fillRect({ x: tile.x, y: tile.y, width: tile.width, height: bar }, grateBar)
        renderer.fillRect({ x: tile.x, y: tile.y + tile.height - bar, width: tile.width, height: bar }, grateBar)
        renderer.fillRect({ x: tile.x + inset, y: tile.y, width: bar, height: tile.height }, grateBar)
        renderer.fillRect({ x: center, y: tile.y, width: bar, height: tile.height }, grateBar)
        renderer.fillRect({ x: far, y: tile.y, width: bar, height: tile.height }, grateBar)
        renderer.fillRect({ x: tile.x, y: tile.y, width: tile.width, height: 1 }, grateHighlight)
    }
}
