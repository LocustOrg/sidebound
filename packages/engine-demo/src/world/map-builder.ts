import type { Rect, Vec2 } from '../core/geometry'
import type { Level, TileArea } from './types'
import { TileRegistry } from './tile-registry'

function toWorldRect(area: TileArea, tileSize: number): Rect {
    return {
        x: area.x * tileSize,
        y: area.y * tileSize,
        width: area.width * tileSize,
        height: area.height * tileSize,
    }
}

/** Greedy row-merge producing minimal rect count from a boolean grid. */
function mergeGrid(grid: readonly (readonly boolean[])[]): TileArea[] {
    const height = grid.length
    if (height === 0) return []
    const width = grid[0].length

    const areas: TileArea[] = []
    let active = new Map<string, TileArea>()

    for (let y = 0; y < height; y++) {
        const next = new Map<string, TileArea>()
        let x = 0

        while (x < width) {
            if (!grid[y][x]) {
                x++
                continue
            }
            const start = x
            while (x < width && grid[y][x]) x++
            const key = `${start}:${x - start}`

            const prev = active.get(key)
            if (prev && prev.y + prev.height === y) {
                prev.height++
                next.set(key, prev)
            } else {
                next.set(key, { x: start, y, width: x - start, height: 1 })
            }
        }

        for (const [key, area] of active) {
            if (!next.has(key)) areas.push(area)
        }
        active = next
    }

    for (const area of active.values()) areas.push(area)
    return areas
}

export class MapBuilder {
    private rows: string[]
    private _tileSize = 28

    private constructor(rows: string[]) {
        this.rows = rows
    }

    static from(rows: string[]): MapBuilder {
        return new MapBuilder(rows)
    }

    static fromSketch(sketch: string): MapBuilder {
        const rows = sketch.split('\n').filter((r) => r.trimEnd().length > 0)
        return new MapBuilder(rows)
    }

    withTileSize(size: number): this {
        this._tileSize = size
        return this
    }

    build(registry: TileRegistry): Level {
        const trimmed = this.rows.map((r) => r.trimEnd())
        const maxWidth = trimmed.reduce((max, r) => Math.max(max, r.length), 0)

        if (maxWidth === 0) {
            throw new Error('Map has no content')
        }

        const padded = trimmed.map((r) => r.padEnd(maxWidth, '.'))
        const height = padded.length
        const width = maxWidth

        const solidGrid: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(false))
        const reflectorGrid: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(false))

        let spawn: Vec2 | undefined
        const placements: { tag: string; position: Vec2 }[] = []

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const glyph = padded[y][x]

                if (!registry.has(glyph)) {
                    throw new Error(`Unknown glyph "${glyph}" at (${x}, ${y}). Register it in TileRegistry first.`)
                }

                const kind = registry.getKind(glyph)

                if (kind === 'solid') {
                    solidGrid[y][x] = true
                } else if (kind === 'passable') {
                    reflectorGrid[y][x] = true
                } else if (kind === 'spawn') {
                    if (spawn) {
                        throw new Error('Map must have exactly one spawn tile.')
                    }
                    spawn = {
                        x: (x + 0.5) * this._tileSize,
                        y: (y + 1) * this._tileSize,
                    }
                }

                const placement = registry.place(glyph, { x, y, tileSize: this._tileSize })
                if (placement) {
                    placements.push(placement)
                }
            }
        }

        if (!spawn) {
            throw new Error('Map must have exactly one spawn tile.')
        }

        const spawnTileX = Math.floor(spawn.x / this._tileSize)
        for (let checkY = Math.floor(spawn.y / this._tileSize); checkY < height; checkY++) {
            if (solidGrid[checkY][spawnTileX]) {
                spawn = { x: spawn.x, y: checkY * this._tileSize }
                break
            }
        }

        return {
            width: width * this._tileSize,
            height: height * this._tileSize,
            spawn,
            solids: mergeGrid(solidGrid).map((a) => toWorldRect(a, this._tileSize)),
            reflectors: mergeGrid(reflectorGrid).map((a) => toWorldRect(a, this._tileSize)),
            sunY: this._tileSize,
        }
    }
}


