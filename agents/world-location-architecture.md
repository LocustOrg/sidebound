# World Location Architecture

The engine should model world structure as a graph of locations, not as one giant
scene and not as custom player-trigger code.

This solves two problems:

- Location-to-location travel is clean, validated data.
- Large maps stay manageable because tile data is chunked and kept out of
  gameplay code.

## Core Model

Use three map scales:

- **Region**: a group of related locations with shared defaults such as tilesets,
  lighting, music, and debug filters.
- **Location**: one playable loadable area. It owns bounds, spawn points,
  tilemaps, entities, and connections.
- **Chunk**: a streaming/render/collision unit inside a location. Chunks keep
  large maps performant and keep TypeScript files small.

The rule:

- Locations own connections.
- Regions own location lists.
- The engine owns validation, loading, unloading, travel, and persistence.

## Open Work

- Runtime `TravelSystem`, transition hooks, connection trigger following, chunk
  streaming, chunk collision/render/light caches, reachability validation,
  reciprocal-link validation, tile-id validation against registered tilesets,
  persistence hooks, and SDL3-rendered world debug overlays.

## Ideal File Shape

```txt
src/world/
  world.ts
  regions/
    cave.region.ts
    forest.region.ts
  locations/
    cave/
      entrance.location.ts
      depths.location.ts
      lake.location.ts
  maps/
    cave/
      entrance/
        terrain.layer.json
        collision.layer.json
        props.layer.json
      depths/
        terrain.layer.json
        collision.layer.json
        props.layer.json
```

## World Definition

```ts
import { defineWorld } from '@sidebound/engine'

import { caveRegion } from './regions/cave.region'
import { forestRegion } from './regions/forest.region'

export const worldMap = defineWorld({
    regions: [caveRegion, forestRegion],
    start: {
        location: 'cave.entrance',
        spawn: 'start',
    },
})
```

## Region Definition

Regions are organization and defaults. They are not giant scenes.

```ts
import { defineRegion } from '@sidebound/engine'

import { caveDepths } from '../locations/cave/depths.location'
import { caveEntrance } from '../locations/cave/entrance.location'
import { caveLake } from '../locations/cave/lake.location'

export const caveRegion = defineRegion({
    id: 'cave',
    tilesets: ['cave'],
    defaults: {
        ambientLight: '#101014',
        music: 'caveLoop',
    },
    locations: [caveEntrance, caveDepths, caveLake],
})
```

## Location Definition

A location owns its tilemap, spawn points, authored entities, and exits.

```ts
import { chunkedTilemap, connection, defineLocation, edgeConnection, rect } from '@sidebound/engine'

export const caveEntrance = defineLocation({
    id: 'cave.entrance',
    region: 'cave',
    bounds: rect([0, 0, 1280, 360]),

    tilemap: chunkedTilemap('world/maps/cave/entrance', {
        chunkSize: [32, 32],
        preloadRadius: 2,
        unloadRadius: 4,
    }),

    spawnPoints: {
        start: [80, 240],
        fromDepths: [1180, 240],
    },

    connections: [
        edgeConnection('right', {
            id: 'to-depths-edge',
            to: {
                location: 'cave.depths',
                spawn: 'fromEntrance',
            },
            transition: 'pan',
        }),

        connection({
            id: 'to-depths-door',
            kind: 'door',
            trigger: rect([1210, 190, 32, 70]),
            action: 'interact',
            to: {
                location: 'cave.depths',
                spawn: 'fromEntranceDoor',
            },
            transition: 'fade',
        }),
    ],
})
```

The target location mirrors its own entry points:

```ts
import { chunkedTilemap, defineLocation, edgeConnection, rect } from '@sidebound/engine'

export const caveDepths = defineLocation({
    id: 'cave.depths',
    region: 'cave',
    bounds: rect([0, 0, 1600, 420]),

    tilemap: chunkedTilemap('world/maps/cave/depths', {
        chunkSize: [32, 32],
        preloadRadius: 2,
        unloadRadius: 4,
    }),

    spawnPoints: {
        fromEntrance: [64, 240],
        fromEntranceDoor: [96, 240],
    },

    connections: [
        edgeConnection('left', {
            id: 'to-entrance-edge',
            to: {
                location: 'cave.entrance',
                spawn: 'fromDepths',
            },
            transition: 'pan',
        }),
    ],
})
```

## Connection Types

The engine should support a small, explicit set of connection kinds:

- `edge`: camera/player crosses a location side.
- `door`: player enters an interaction trigger.
- `ladder`: player moves through a vertical connector.
- `portal`: player uses a non-spatial or magical connector.
- `fall`: player exits through a pit/drop.
- `debug`: dev-only travel shortcut.

Connection data should describe intent. The engine should own trigger detection,
travel locking, fade/pan transition timing, unload/load ordering, and player
placement.

## Travel API

Game-specific code should rarely need manual travel, but the engine should expose
a clear API for debug tools, scripted events, and tests.

```ts
world.travel.to('cave.depths', {
    spawn: 'fromEntrance',
    transition: 'fade',
})
```

Connections can call the same path internally:

```ts
world.travel.follow('to-depths-door')
```

## Chunked Maps

Large maps should be data, not code. Location files point at a map folder, and
the engine streams chunks near the camera.

```ts
chunkedTilemap('world/maps/cave/entrance', {
    chunkSize: [32, 32],
    preloadRadius: 2,
    unloadRadius: 4,
    collision: {
        build: 'per-chunk',
        cache: true,
    },
    rendering: {
        cacheStaticLayers: true,
    },
})
```

Recommended chunk responsibilities:

- Load tile layers near the camera.
- Build and cache static collision for loaded chunks.
- Build and cache static occluders for lighting.
- Render static terrain into chunk render targets.
- Unload far chunks after they leave the unload radius.
- Keep dynamic entities separate from tile chunk data.

## Validation

The engine should validate world definitions before the first frame:

- Region ids are unique.
- Location ids are unique.
- Each location references an existing region.
- Each world start location exists.
- Each world start spawn exists.
- Each connection id is unique within its location.
- Each connection target location exists.
- Each connection target spawn point exists.
- Required reciprocal connections exist when configured.
- Required locations are reachable from the world start.
- Chunk paths exist.
- Chunk sizes match the location tile size.
- Tile ids used by map data exist in registered tilesets.
- Connection triggers are inside location bounds.
- Spawn points are inside location bounds.
- Spawn points do not start inside solid collision.

Validation should produce actionable errors with ids and file paths.

## Persistence

Persistent game state should be keyed by stable ids:

```ts
world.flags.set('cave.entrance.door-open', true)
world.locations.markVisited('cave.depths')
world.locations.setPersistentEntityState('cave.entrance', 'crate-01', {
    destroyed: true,
})
```

Do not serialize raw chunk internals unless a game explicitly needs mutable
terrain. Prefer persistent flags, visited locations, unlocked connections, and
entity state overrides.

## Debug Expectations

World debugging should make connections and chunk streaming visible:

- Current region and location.
- Loaded chunks and unload radius.
- Location bounds.
- Spawn points.
- Connection triggers.
- Connection target labels.
- Broken connection validation errors.
- Last travel source and destination.
- Travel transition state.
- Persistent flags for the current location.

## Non-Goals For Now

- Procedural world generation.
- Infinite maps.
- Runtime tile painting as a required workflow.
- Editor-only scene graphs.
- Serializing every tile in every chunk as gameplay state.

These can come later, but the code-first region/location/chunk model should stay
pleasant without them.
