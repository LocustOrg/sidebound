import type { Rect, Vec2 } from '../core/mod.ts'

export type TileCollision = 'none' | 'solid'
export type TileLightOcclusion = 'none' | 'opaque' | 'vertical-bar'

export type TileDefinition<TMaterial extends string = string> = {
    glyph: string
    material?: TMaterial
    collision?: TileCollision
    light?: TileLightOcclusion
    spawn?: boolean
}

export type PlacedTile<TMaterial extends string = string> = Rect & {
    glyph: string
    material: TMaterial
}

export type TileArea = {
    x: number
    y: number
    width: number
    height: number
}

export type TileMapBuildResult<TMaterial extends string = string> = {
    width: number
    height: number
    spawn: Vec2
    solids: Rect[]
    lightOccluders: Rect[]
    tiles: PlacedTile<TMaterial>[]
    sunY: number
}

export class TileRegistry<TMaterial extends string = string> {
    private readonly tiles = new Map<string, TileDefinition<TMaterial>>()

    register(definition: TileDefinition<TMaterial>): this {
        if (definition.glyph.length !== 1) {
            throw new Error(`Glyph must be a single character, got "${definition.glyph}"`)
        }
        if (!definition.spawn && !definition.material) {
            throw new Error(`Tile "${definition.glyph}" must define a material or mark itself as spawn.`)
        }

        this.tiles.set(definition.glyph, definition)
        return this
    }

    get(glyph: string): TileDefinition<TMaterial> | undefined {
        return this.tiles.get(glyph)
    }

    has(glyph: string): boolean {
        return this.tiles.has(glyph)
    }

    glyphs(): string[] {
        return [...this.tiles.keys()]
    }
}

const emptyGlyph = ' '

function toWorldRect(area: TileArea, tileSize: number): Rect {
    return {
        x: area.x * tileSize,
        y: area.y * tileSize,
        width: area.width * tileSize,
        height: area.height * tileSize,
    }
}

function toTileRect(x: number, y: number, tileSize: number): Rect {
    return {
        x: x * tileSize,
        y: y * tileSize,
        width: tileSize,
        height: tileSize,
    }
}

function createVerticalBarLightOccluders(x: number, y: number, tileSize: number): Rect[] {
    const left = x * tileSize
    const top = y * tileSize
    const bar = Math.max(2, Math.round(tileSize * 0.12))
    const center = left + Math.floor((tileSize - bar) / 2)

    return [{ x: center, y: top, width: bar, height: tileSize }]
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

export class TileMapBuilder<TMaterial extends string = string> {
    private rows: string[]
    private _tileSize = 28

    private constructor(rows: string[]) {
        this.rows = rows
    }

    static from<TMaterial extends string = string>(rows: string[]): TileMapBuilder<TMaterial> {
        return new TileMapBuilder<TMaterial>(rows)
    }

    static fromSketch<TMaterial extends string = string>(sketch: string): TileMapBuilder<TMaterial> {
        const rows = sketch.split('\n').filter((r) => r.trimEnd().length > 0)
        return new TileMapBuilder<TMaterial>(rows)
    }

    withTileSize(size: number): this {
        this._tileSize = size
        return this
    }

    build(registry: TileRegistry<TMaterial>): TileMapBuildResult<TMaterial> {
        const trimmed = this.rows.map((r) => r.trimEnd())
        const maxWidth = trimmed.reduce((max, r) => Math.max(max, r.length), 0)

        if (maxWidth === 0) {
            throw new Error('Map has no content')
        }

        const padded = trimmed.map((r) => r.padEnd(maxWidth, emptyGlyph))
        const height = padded.length
        const width = maxWidth

        const solidGrid: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(false))
        const opaqueLightGrid: boolean[][] = Array.from({ length: height }, () => Array<boolean>(width).fill(false))
        const tiles: PlacedTile<TMaterial>[] = []
        const verticalBarLightOccluders: Rect[] = []

        let spawn: Vec2 | undefined

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const glyph = padded[y][x]

                if (glyph === emptyGlyph) {
                    continue
                }

                const definition = registry.get(glyph)
                if (!definition) {
                    throw new Error(`Unknown glyph "${glyph}" at (${x}, ${y}). Register it in TileRegistry first.`)
                }

                if (definition.spawn) {
                    if (spawn) {
                        throw new Error('Map must have exactly one spawn tile.')
                    }
                    spawn = {
                        x: (x + 0.5) * this._tileSize,
                        y: (y + 1) * this._tileSize,
                    }
                }

                if (definition.material) {
                    tiles.push({
                        ...toTileRect(x, y, this._tileSize),
                        glyph,
                        material: definition.material,
                    })
                }

                if (definition.collision === 'solid') {
                    solidGrid[y][x] = true
                }

                switch (definition.light ?? 'none') {
                    case 'opaque':
                        opaqueLightGrid[y][x] = true
                        break
                    case 'vertical-bar':
                        verticalBarLightOccluders.push(...createVerticalBarLightOccluders(x, y, this._tileSize))
                        break
                    case 'none':
                        break
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
            lightOccluders: [...mergeGrid(opaqueLightGrid).map((a) => toWorldRect(a, this._tileSize)), ...verticalBarLightOccluders],
            tiles,
            sunY: this._tileSize,
        }
    }
}
