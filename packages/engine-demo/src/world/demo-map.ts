import type { Rect, Vec2 } from '../core/geometry'

type TileArea = {
    x: number
    y: number
    width: number
    height: number
}

export type Level = {
    width: number
    height: number
    spawn: Vec2
    solids: Rect[]
    reflectors: Rect[]
    sunY: number
}

export const tileSize = 28
export const viewport = {
    width: 450,
    height: 250,
}

const solidGlyph = '#'
const spawnGlyph = '@'
const reflectorGlyph = '|'
const platformGlyph = '='
const emptyGlyphs = new Set([' ', '.', '~'])
const demoPlayerBounds = {
    width: 8 / tileSize,
    height: 28 / tileSize,
}

function toWorldRect(area: TileArea): Rect {
    return {
        x: area.x * tileSize,
        y: area.y * tileSize,
        width: area.width * tileSize,
        height: area.height * tileSize,
    }
}

function toSpawnPoint(tile: Vec2): Vec2 {
    return {
        x: (tile.x + 0.5 - demoPlayerBounds.width / 2) * tileSize,
        y: (tile.y + 1 - demoPlayerBounds.height) * tileSize,
    }
}

function parseLevelSketch(sketch: string): string[] {
    const rows = sketch
        .trim()
        .split('\n')
        .map((row) => row.trim())
    const width = rows[0]?.length ?? 0

    if (width === 0) {
        throw new Error('Map sketch must include at least one row.')
    }

    rows.forEach((row, y) => {
        if (row.length !== width) {
            throw new Error(`Map sketch row ${y} is ${row.length} tiles wide, but the first row is ${width}.`)
        }
    })

    return rows
}

function createSolidGrid(width: number, height: number): boolean[][] {
    return Array.from({ length: height }, () => Array<boolean>(width).fill(false))
}

function addBoundary(grid: boolean[][]): void {
    const width = grid[0].length
    const lastRow = grid.length - 1
    const lastColumn = width - 1

    for (let x = 0; x < width; x += 1) {
        grid[0][x] = true
        grid[lastRow][x] = true
    }

    for (let y = 0; y < grid.length; y += 1) {
        grid[y][0] = true
        grid[y][lastColumn] = true
    }
}

function findRowRuns(row: readonly boolean[]): TileArea[] {
    const runs: TileArea[] = []
    let x = 0

    while (x < row.length) {
        while (x < row.length && !row[x]) {
            x += 1
        }

        const start = x

        while (x < row.length && row[x]) {
            x += 1
        }

        if (x > start) {
            runs.push({ x: start, y: 0, width: x - start, height: 1 })
        }
    }

    return runs
}

function mergeSolidTiles(grid: readonly (readonly boolean[])[]): TileArea[] {
    const areas: TileArea[] = []
    let activeAreas = new Map<string, TileArea>()

    for (let y = 0; y < grid.length; y += 1) {
        const nextActiveAreas = new Map<string, TileArea>()
        const runs = findRowRuns(grid[y])

        for (const run of runs) {
            const key = `${run.x}:${run.width}`
            const activeArea = activeAreas.get(key)

            if (activeArea !== undefined) {
                activeArea.height += 1
                nextActiveAreas.set(key, activeArea)
            } else {
                nextActiveAreas.set(key, { ...run, y, height: 1 })
            }
        }

        for (const [key, area] of activeAreas) {
            if (!nextActiveAreas.has(key)) {
                areas.push(area)
            }
        }

        activeAreas = nextActiveAreas
    }

    areas.push(...activeAreas.values())

    return areas
}

function createLevelFromRows(rows: readonly string[], width: number): Level {
    const height = rows.length + 2
    const grid = createSolidGrid(width + 2, height)
    const reflectorGrid = createSolidGrid(width + 2, height)
    let spawn: Vec2 | undefined

    addBoundary(grid)

    rows.forEach((row, sourceY) => {
        if (row.length > width) {
            throw new Error(`Map sketch row ${sourceY} is ${row.length} tiles wide, but the level width is ${width}.`)
        }

        for (let sourceX = 0; sourceX < row.length; sourceX += 1) {
            const glyph = row[sourceX]
            const x = sourceX + 1
            const y = sourceY + 1

            if (glyph === solidGlyph) {
                grid[y][x] = true
                continue
            }

            if (glyph === platformGlyph) {
                grid[y][x] = true
                continue
            }

            if (glyph === reflectorGlyph) {
                reflectorGrid[y][x] = true
                continue
            }

            if (glyph === spawnGlyph) {
                if (spawn !== undefined) {
                    throw new Error('Map sketch can only contain one player spawn marker.')
                }

                spawn = toSpawnPoint({ x, y })
                continue
            }

            if (!emptyGlyphs.has(glyph)) {
                throw new Error(`Unsupported map sketch glyph "${glyph}" at ${sourceX}, ${sourceY}.`)
            }
        }
    })

    if (spawn === undefined) {
        throw new Error('Map sketch must include one player spawn marker.')
    }

    // Validate spawn is above solid ground and within bounds
    const playerPixelWidth = demoPlayerBounds.width * tileSize
    const playerPixelHeight = demoPlayerBounds.height * tileSize

    // Clamp X to be within the world boundaries (inside the boundary walls)
    spawn = {
        x: Math.max(tileSize + 2, Math.min(spawn.x, (grid[0].length - 1) * tileSize - playerPixelWidth - 2)),
        y: spawn.y,
    }

    const spawnTileX = Math.floor(spawn.x / tileSize)
    const spawnTileY = Math.floor(spawn.y / tileSize)
    // Search downward for ground to ensure player doesn't fall out of bounds
    let groundFound = false
    for (let checkY = spawnTileY; checkY < height; checkY++) {
        if (grid[checkY] && grid[checkY][spawnTileX]) {
            groundFound = true
            // Place player directly above the ground tile
            spawn = {
                x: spawn.x,
                y: checkY * tileSize - playerPixelHeight,
            }
            break
        }
    }

    if (!groundFound) {
        // Fallback: place on the bottom boundary
        spawn = {
            x: spawn.x,
            y: (height - 2) * tileSize - playerPixelHeight,
        }
    }

    return {
        width: grid[0].length * tileSize,
        height: grid.length * tileSize,
        spawn,
        solids: mergeSolidTiles(grid).map(toWorldRect),
        reflectors: mergeSolidTiles(reflectorGrid).map(toWorldRect),
        sunY: tileSize, // Sun sits at top boundary
    }
}

function createLevelFromSketch(sketch: string): Level {
    const rows = parseLevelSketch(sketch)

    return createLevelFromRows(rows, rows[0].length)
}

/**
 * Programmatically generates a humongous map for performance testing.
 * Width: 400 tiles, Height: 120 tiles
 * Features: platforms, reflectors, varied terrain patterns, safe spawn.
 */
function generateHumongousMap(): string {
    const W = 400
    const H = 120
    const grid: string[][] = Array.from({ length: H }, () => Array(W).fill('.'))

    // Bottom solid floor (last 3 rows)
    for (let y = H - 3; y < H; y++) {
        for (let x = 0; x < W; x++) {
            grid[y][x] = '#'
        }
    }

    // Spawn point near bottom-left, above the floor
    grid[H - 4][6] = '@'

    // Create repeating platform sections every ~18 rows going upward
    const sectionHeight = 18
    const numSections = Math.floor((H - 8) / sectionHeight)

    for (let section = 0; section < numSections; section++) {
        const baseY = H - 4 - (section + 1) * sectionHeight

        if (baseY < 3) break

        const pattern = section % 6

        switch (pattern) {
            case 0: {
                // Scattered platforms with reflector columns
                for (let x = 10; x < W - 10; x += 22) {
                    const pLen = 8 + (x % 5)
                    for (let px = 0; px < pLen && x + px < W - 2; px++) {
                        grid[baseY][x + px] = '#'
                    }
                }
                for (let x = 6; x < W - 6; x += 34) {
                    for (let ry = baseY - 4; ry < baseY; ry++) {
                        if (ry >= 0) grid[ry][x] = '|'
                    }
                }
                break
            }
            case 1: {
                // Platform bridges with gaps
                for (let x = 8; x < W - 8; x += 28) {
                    for (let px = 0; px < 12 && x + px < W - 2; px++) {
                        grid[baseY][x + px] = '='
                    }
                }
                break
            }
            case 2: {
                // Dense reflector wall with platform below
                for (let x = 4; x < W - 4; x += 6) {
                    if (baseY + 2 < H - 3) {
                        grid[baseY + 2][x] = '|'
                        if (x + 1 < W) grid[baseY + 2][x + 1] = '|'
                    }
                }
                for (let x = 14; x < W - 14; x += 30) {
                    for (let px = 0; px < 16 && x + px < W - 2; px++) {
                        grid[baseY][x + px] = '#'
                    }
                }
                break
            }
            case 3: {
                // Staircase pattern
                for (let step = 0; step < 8; step++) {
                    const sx = 10 + step * 18
                    const sy = baseY - step
                    if (sy < 1 || sx + 6 >= W - 2) break
                    for (let px = 0; px < 6; px++) {
                        grid[sy][sx + px] = '#'
                    }
                }
                for (let step = 0; step < 8; step++) {
                    const sx = W - 16 - step * 18
                    const sy = baseY - step
                    if (sy < 1 || sx < 2) break
                    for (let px = 0; px < 6; px++) {
                        if (sx + px < W) grid[sy][sx + px] = '#'
                    }
                }
                break
            }
            case 4: {
                // Large platforms with reflector curtains above
                for (let x = 8; x < W - 8; x += 40) {
                    for (let px = 0; px < 20 && x + px < W - 2; px++) {
                        grid[baseY][x + px] = '#'
                    }
                    for (let rx = x + 2; rx < x + 18 && rx < W - 2; rx += 3) {
                        for (let ry = baseY - 6; ry < baseY; ry++) {
                            if (ry >= 0) grid[ry][rx] = '|'
                        }
                    }
                }
                break
            }
            case 5: {
                // Alternating thin and wide platforms
                for (let x = 6; x < W - 6; x += 16) {
                    const isWide = (x / 16) % 2 === 0
                    const pLen = isWide ? 10 : 4
                    for (let px = 0; px < pLen && x + px < W - 2; px++) {
                        grid[baseY][x + px] = '='
                    }
                }
                for (let x = 12; x < W - 12; x += 24) {
                    for (let dy = 1; dy <= 3; dy++) {
                        if (baseY - dy >= 0) grid[baseY - dy][x] = '|'
                    }
                }
                break
            }
        }
    }

    // Tall reflector columns near top for sun interaction
    for (let x = 20; x < W - 20; x += 50) {
        for (let y = 2; y < 8; y++) {
            grid[y][x] = '|'
            if (x + 1 < W) grid[y][x + 1] = '|'
        }
    }

    return grid.map((row) => row.join('')).join('\n')
}

const levelSketch = generateHumongousMap()

export const world = createLevelFromSketch(levelSketch)
