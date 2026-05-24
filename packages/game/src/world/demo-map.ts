import { assertValidWorldDefinition, chunkedTilemap, defineLocation, defineRegion, defineWorld, edgeConnection, rect } from '@strange-path/engine'
import { TileRegistry } from './tile-registry'
import { MapBuilder } from './map-builder'
import type { Level, Viewport } from './types'

export type { Level, Viewport }
export { type TileDefinition, type TileKind, type RenderHint } from './types'
export { TileRegistry } from './tile-registry'
export { MapBuilder } from './map-builder'

export const tileSize = 28
export const viewport: Viewport = { width: 450, height: 250 }

const registry = new TileRegistry()
    .register({ glyph: '#', kind: 'solid' })
    .register({ glyph: '=', kind: 'solid' })
    .register({ glyph: '|', kind: 'passable' })
    .register({ glyph: '@', kind: 'spawn' })

const MAP_ROWS = [
    '##################################################',
    '#................................................#',
    '#................................................#',
    '#................................................#',
    '#..|.......|......|.......|......|..............|#',
    '#................................................#',
    '#................................................#',
    '#...=========.......=========....................#',
    '#................................................#',
    '#................................................#',
    '#.......|........|.........|...........####......#',
    '#................................####...........##',
    '#..####.......####.............##...............##',
    '#...............................................##',
    '#..|.......|......|........##..................###',
    '#............................................#####',
    '#...========......========...................#####',
    '#.........................................########',
    '#.......|........|.........|............##########',
    '#..............................................###',
    '#..####.....####.....####..........####.........##',
    '#...............................................##',
    '#..|......|......|.......|..........|............#',
    '#..@.............................................#',
    '#................................................#',
    '##################################################',
    '##################################################',
    '##################################################',
]

export const world: Level = MapBuilder.from(MAP_ROWS).withTileSize(tileSize).build(registry)

export const demoLocation = defineLocation({
    id: 'debug.main',
    region: 'debug',
    bounds: rect([0, 0, world.width, world.height]),
    tilemap: chunkedTilemap('inline/demo-map', {
        chunkSize: [16, 16],
        preloadRadius: 1,
        unloadRadius: 2,
    }),
    spawnPoints: {
        start: [world.spawn.x, world.spawn.y],
    },
    connections: [
        edgeConnection('right', {
            id: 'debug-loop-right',
            to: { location: 'debug.main', spawn: 'start' },
            transition: 'debug',
        }),
    ],
})

export const demoRegion = defineRegion({
    id: 'debug',
    locations: [demoLocation],
})

export const demoWorld = defineWorld({
    regions: [demoRegion],
    start: { location: demoLocation.id, spawn: 'start' },
})

assertValidWorldDefinition(demoWorld)
