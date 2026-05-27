import { assertValidWorldDefinition, chunkedTilemap, defineLocation, defineRegion, defineWorld, edgeConnection, rect, TileMapBuilder, TileRegistry } from '@sidebound/engine'
import type { Level, TileMaterial, Viewport } from './types.ts'

export const tileSize = 28
export const viewport: Viewport = { width: 450, height: 250 }

const mapWidth = 50

function wallRow(): string {
    return '#'.repeat(mapWidth)
}

function row(content = ''): string {
    return `#${content.padEnd(mapWidth - 2, ' ').slice(0, mapWidth - 2)}#`
}

const registry = new TileRegistry<TileMaterial>()
    .register({ glyph: '#', material: 'wall', collision: 'solid', light: 'opaque' })
    .register({ glyph: 'C', material: 'glass', collision: 'none', light: 'none' })
    .register({ glyph: '.', material: 'decor', collision: 'none', light: 'none' })
    .register({ glyph: 'G', material: 'grate', collision: 'solid', light: 'vertical-bar' })
    .register({ glyph: '@', spawn: true })

export type SunPlacement = {
    readonly column: number
    readonly row: number
}

const MAP_ROWS = [
    wallRow(),
    row('          C          .        C          GGGG'),
    row('                    ####       G  G'),
    row('      GGGG                      G  G     C'),
    row('      G  G       ######       GGGG'),
    row('      GGGG'),
    row('             C           .'),
    row('   #######             ####        GGGGGG'),
    row('                       #  #        G    G'),
    row('    .        C         #  #     C  GGGGGG'),
    row('             #####     ####'),
    row(),
    row('        GGGG                 C       ####'),
    row('        G  G      .                  #'),
    row('     C  G  G           ####          #   .'),
    row('        GGGG                 GGGGGG  ######'),
    row('                             G    G'),
    row('       ######        C       GGGGGG'),
    row('  .'),
    row('                 #######'),
    row('   @    C                 .       C'),
    row('                        GGGG'),
    row('############      #######GGGG       ########'),
    row('          #          #        .'),
    row('   GGGG   #       C  #              GGGG'),
    row('   G  G          ######              G  G'),
    row('   GGGG                              GGGG'),
    wallRow(),
]

export const initialSunPlacements: readonly SunPlacement[] = [
    { column: 8, row: 14 },
    { column: 17, row: 11 },
    { column: 27, row: 5 },
    { column: 37, row: 4 },
    { column: 43, row: 13 },
    { column: 21, row: 20 },
]

export const world: Level = TileMapBuilder.from<TileMaterial>(MAP_ROWS).withTileSize(tileSize).build(registry)

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
