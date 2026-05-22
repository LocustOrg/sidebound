export type Vec2 = {
    x: number
    y: number
}

export type Rect = {
    x: number
    y: number
    width: number
    height: number
}

type TileRect = readonly [x: number, y: number, width: number, height: number]

export type Level = {
    width: number
    height: number
    spawn: Vec2
    solids: Rect[]
}

export const tileSize = 8
export const viewport = {
    width: 240,
    height: 135,
}

const levelTiles = {
    width: 120,
    height: 28,
    spawn: { x: 4, y: 22.75 },
    solids: [
        solid(0, 0, 120, 1),
        solid(0, 27, 120, 1),
        solid(0, 0, 1, 28),
        solid(119, 0, 1, 28),

        solid(1, 24, 18, 3),
        solid(23, 24, 21, 3),
        solid(49, 24, 20, 3),
        solid(76, 24, 18, 3),
        solid(101, 24, 18, 3),

        solid(18, 20, 22, 1),
        solid(46, 18, 24, 1),
        solid(78, 16, 22, 1),
        solid(15, 14, 14, 1),
        solid(37, 12, 18, 1),
        solid(62, 10, 16, 1),
        solid(91, 13, 18, 1),

        solid(30, 7, 2, 14),
        solid(66, 6, 2, 19),
        solid(86, 16, 2, 9),
        solid(111, 9, 2, 16),
    ],
}

export const world = createLevel(levelTiles)

function solid(x: number, y: number, width: number, height: number): TileRect {
    return [x, y, width, height]
}

function createLevel(level: { width: number; height: number; spawn: Vec2; solids: TileRect[] }): Level {
    return {
        width: level.width * tileSize,
        height: level.height * tileSize,
        spawn: toWorldPoint(level.spawn),
        solids: level.solids.map(toWorldRect),
    }
}

function toWorldPoint(point: Vec2): Vec2 {
    return {
        x: point.x * tileSize,
        y: point.y * tileSize,
    }
}

function toWorldRect([x, y, width, height]: TileRect): Rect {
    return {
        x: x * tileSize,
        y: y * tileSize,
        width: width * tileSize,
        height: height * tileSize,
    }
}
