import type { Canvas2DPreviewRenderFrame, RenderContext, RenderLayer } from '@sidebound/engine'
import type { Level, PlacedTile } from '../../world/types.ts'

export class TerrainLayer implements RenderLayer {
    readonly order = 10
    private readonly tiles: PlacedTile[]

    constructor(world: Level) {
        this.tiles = world.tiles
    }

    render(frame: Canvas2DPreviewRenderFrame): void {
        const { context } = frame

        for (const tile of this.tiles) {
            switch (tile.material) {
                case 'wall':
                    this.drawWall(context, tile)
                    break
                case 'glass':
                    this.drawGlass(context, tile)
                    break
                case 'decor':
                    this.drawDecor(context, tile)
                    break
                case 'grate':
                    this.drawGrate(context, tile)
                    break
            }
        }
    }

    private drawWall(context: RenderContext, tile: PlacedTile): void {
        context.fillStyle = '#4e4668'
        context.fillRect(tile.x, tile.y, tile.width, tile.height)
        context.fillStyle = '#6e6488'
        context.fillRect(tile.x, tile.y, tile.width, 1)
        context.fillStyle = '#362f48'
        context.fillRect(tile.x, tile.y + tile.height - 1, tile.width, 1)
    }

    private drawGlass(context: RenderContext, tile: PlacedTile): void {
        context.save()
        context.globalAlpha = 0.55
        const grad = context.createLinearGradient(tile.x, tile.y, tile.x + tile.width, tile.y + tile.height)
        grad.addColorStop(0, '#88ccff')
        grad.addColorStop(0.5, '#aaeeff')
        grad.addColorStop(1, '#6699dd')
        context.fillStyle = grad
        context.fillRect(tile.x, tile.y, tile.width, tile.height)
        context.globalAlpha = 0.85
        context.fillStyle = '#d7f6ff'
        context.fillRect(tile.x + 4, tile.y + 4, tile.width - 8, 2)
        context.fillRect(tile.x + 4, tile.y + 4, 2, tile.height - 8)
        context.restore()
    }

    private drawDecor(context: RenderContext, tile: PlacedTile): void {
        const cx = tile.x + Math.floor(tile.width / 2)
        const cy = tile.y + Math.floor(tile.height / 2)

        context.fillStyle = '#7bd0b1'
        context.fillRect(cx - 1, cy - 1, 3, 3)
        context.fillStyle = '#b5f6d9'
        context.fillRect(cx, cy - 5, 1, 11)
        context.fillRect(cx - 5, cy, 11, 1)
    }

    private drawGrate(context: RenderContext, tile: PlacedTile): void {
        const bar = Math.max(2, Math.round(tile.width * 0.12))
        const inset = Math.max(3, Math.round(tile.width * 0.16))
        const center = tile.x + Math.floor((tile.width - bar) / 2)
        const far = tile.x + tile.width - inset - bar

        context.fillStyle = '#28222f'
        context.fillRect(tile.x, tile.y, tile.width, tile.height)
        context.fillStyle = '#9f8c72'
        context.fillRect(tile.x, tile.y, tile.width, bar)
        context.fillRect(tile.x, tile.y + tile.height - bar, tile.width, bar)
        context.fillRect(tile.x + inset, tile.y, bar, tile.height)
        context.fillRect(center, tile.y, bar, tile.height)
        context.fillRect(far, tile.y, bar, tile.height)
        context.fillStyle = '#d7b77c'
        context.fillRect(tile.x, tile.y, tile.width, 1)
    }
}
