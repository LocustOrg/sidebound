# North Star Engine API

## Intent

This file describes the target developer experience for `@strange-path/engine`.
It is not a statement of what exists today. It is the north-star API shape for
the engine roadmap.

The engine should be code-first and Deno-first. There is no Unity/Unreal-style
editor, no hidden scene database, and no required visual authoring tool. A game
should be built from normal TypeScript files, asset folders, typed data
definitions, and a small Deno entrypoint.

Sprite and item content architecture details live in
`sprite-content-architecture.md`; this file shows how that model should feel
from game code.

The ideal workflow is:

1. Define assets once.
2. Register characters, equipment, items, tiles, actors, sounds, and scenes as
   TypeScript modules.
3. Start the engine with a single Deno-run entrypoint.
4. Use debug tools to inspect the runtime.

Most user code should live in actual game files. The engine should provide
simple factories, strong types, good defaults, validation, hot-reload-friendly
data shapes, and debug visibility.

## Platform Rule

Deno is the assumed runtime platform for game code.

Game code and engine core must not call native browser APIs directly:

- No `document`.
- No `window`.
- No `HTMLCanvasElement`.
- No `CanvasRenderingContext2D`.
- No `AudioContext`.
- No `localStorage`.
- No `requestAnimationFrame`.
- No `navigator.getGamepads()`.

Those APIs may exist behind a platform adapter, but game code should only see
engine-owned interfaces for windowing, rendering, input, audio, storage, timers,
and debug UI.

The same game code should be able to run through:

- `@strange-path/platform-deno` for the intended runtime.
- `@strange-path/platform-desktop` later for packaged desktop apps.
- `@strange-path/platform-browser-preview` only as a development preview adapter,
  not as the engine's native architecture.

## Design Principles

- Code-first over editor-first.
- Deno runtime for scripts, tests, asset validation, tooling, and app entrypoints.
- Plain TypeScript modules over custom file formats, except where external
  assets already have strong formats (`.png`, `.json`, `.tmj`, `.ogg`, etc.).
- One obvious path for common tasks: add character sprite, add equipment, add
  item, add sound, add tile, add player, add mob, add scene.
- Engine systems are reusable; game files define content and behavior.
- Favor declarative definitions for content and imperative code for unique game
  logic.
- Prefer typed config objects and small factories over inheritance-heavy APIs.
- Keep platform bindings at the edge.
- Make debug rooms cheap to write.
- Make production scenes data-driven enough to refactor safely.
- Validate content at startup with clear errors.

## Ideal Project Shape

```txt
packages/game/
  deno.json
  assets/
    sprites/
      player.png
      slime.png
      props.png
    tiles/
      cave.png
    audio/
      player-attack.ogg
      tile-interact.ogg
      mob-hit.ogg
      crate-hit.ogg
  src/
    main.ts
    game.ts
    assets.ts
    content/
      index.ts
      characters/
        player.character.ts
        slime.character.ts
      equipment/
        red-cape.equipment.ts
      items/
        starter-items.ts
    tilesets/
      cave.tileset.ts
    scenes/
      debug-room.scene.ts
      physics-lab.scene.ts
      lighting-lab.scene.ts
    entities/
      player.entity.ts
      mobs/
        slime.entity.ts
      props/
        crate.entity.ts
    systems/
      player-controller.system.ts
      slime-ai.system.ts
```

## Pseudo Project

### `deno.json`

The game should run through Deno directly.

```json
{
    "tasks": {
        "dev": "deno run --watch --allow-read --allow-env --allow-write --allow-ffi src/main.ts",
        "start": "deno run --allow-read --allow-env --allow-write --allow-ffi src/main.ts",
        "test": "deno test --allow-read --allow-env",
        "check": "deno check src/main.ts && deno test --allow-read --allow-env",
        "compile:desktop": "deno compile --allow-read --allow-env --allow-write --allow-ffi --output dist/strange-path src/main.ts"
    },
    "imports": {
        "@strange-path/engine": "../engine/src/index.ts",
        "@strange-path/platform-deno": "../platform-deno/src/index.ts"
    }
}
```

### `src/main.ts`

The entrypoint should stay tiny. It should choose a platform adapter, load the
game definition, and start the engine.

```ts
import { createEngine } from '@strange-path/engine'
import { createDenoPlatform } from '@strange-path/platform-deno'

import { game } from './game'

const platform = await createDenoPlatform({
    appId: 'strange-path.debug-harness',
    window: {
        title: 'Strange Path Debug Harness',
        size: [1280, 720],
        minSize: [768, 432],
        pixelScale: 'integer-fit',
    },
    storage: {
        namespace: 'strange-path',
    },
})

const engine = await createEngine({
    platform,
    game,
    debug: {
        enabled: platform.env.dev,
        openOnStart: true,
    },
})

await engine.run()
```

### `src/game.ts`

The game definition should connect global settings, assets, and scenes. It
should not contain real gameplay code.

```ts
import { defineGame } from '@strange-path/engine'

import { assets } from './assets'
import { content } from './content'
import { debugRoom } from './scenes/debug-room.scene'
import { lightingLab } from './scenes/lighting-lab.scene'
import { physicsLab } from './scenes/physics-lab.scene'

export const game = defineGame({
    id: 'strange-path-debug-harness',
    title: 'Strange Path Debug Harness',

    runtime: {
        platform: 'deno',
        perspective: 'side-view',
    },

    tickRate: 60,

    assets,
    content,

    world: {
        gravity: [0, 1400],
        units: 'pixels',
    },

    renderer: {
        virtualSize: [384, 216],
        clearColor: '#101014',
        layers: ['background', 'terrain', 'entities', 'lighting', 'fx', 'ui', 'debug'],
    },

    audio: {
        defaultBus: 'sfx',
        buses: {
            music: { volume: 0.7 },
            sfx: { volume: 0.9 },
            ui: { volume: 0.8 },
        },
    },

    scenes: [debugRoom, physicsLab, lightingLab],
    startScene: 'debug-room',
})
```

### `src/assets.ts`

Assets should be named once, then referenced by stable ids everywhere else.
Raw sprite sheets and sound files are asset-layer concerns. Character clips,
equipment layers, item icons, sockets, and gameplay metadata live in content
modules.

```ts
import { defineAssets, image, sample, spriteSheet, tileAtlas } from '@strange-path/engine'

export const assets = defineAssets({
    root: './assets',

    images: {
        player: image('sprites/player.png'),
        slime: image('sprites/slime.png'),
        props: image('sprites/props.png'),
        caveTiles: image('tiles/cave.png'),
    },

    sprites: {
        player: spriteSheet('player', {
            image: 'player',
            frameSize: [32, 32],
            pivot: [16, 24],
            clips: {
                idle: { frames: [0, 1, 2, 3], fps: 8, loop: true },
                run: { frames: [8, 9, 10, 11, 12, 13], fps: 12, loop: true },
                jump: { frames: [16], fps: 1, loop: false },
                fall: { frames: [17], fps: 1, loop: false },
                attack: { frames: [24, 25, 26, 27], fps: 16, loop: false },
                hurt: { frames: [32, 33], fps: 10, loop: false },
            },
        }),

        slime: spriteSheet('slime', {
            image: 'slime',
            frameSize: [24, 16],
            pivot: [12, 14],
            clips: {
                idle: { frames: [0, 1, 2, 3], fps: 6, loop: true },
                hop: { frames: [8, 9, 10, 11], fps: 10, loop: true },
                hurt: { frames: [16, 17], fps: 10, loop: false },
            },
        }),

        props: spriteSheet('props', {
            image: 'props',
            frameSize: [16, 16],
            pivot: [8, 16],
            clips: {
                crate: { frames: [0], fps: 1, loop: false },
                redCape: { frames: [8], fps: 1, loop: false },
                redCapeIcon: { frames: [9], fps: 1, loop: false },
            },
        }),
    },

    atlases: {
        cave: tileAtlas('caveTiles', {
            image: 'caveTiles',
            tileSize: [16, 16],
        }),
    },

    sounds: {
        playerAttack: sample('audio/player-attack.ogg'),
        tileInteract: sample('audio/tile-interact.ogg'),
        mobHit: sample('audio/mob-hit.ogg'),
        crateHit: sample('audio/crate-hit.ogg'),
    },
})
```

### `src/content/index.ts`

Content registration should be explicit and centralized. Individual content
modules should export definitions; the index decides what enters the game.

```ts
import { defineContent } from '@strange-path/engine'

import { redCape } from './equipment/red-cape.equipment'
import { starterItems } from './items/starter-items'
import { playerCharacter } from './characters/player.character'
import { slimeCharacter } from './characters/slime.character'

export const content = defineContent({
    characters: [playerCharacter, slimeCharacter],
    equipment: [redCape],
    items: starterItems,
})
```

### `src/content/characters/player.character.ts`

Character definitions own visual identity: atlas, frame grid, clips, sockets,
default hitbox, and render offset. Gameplay entities can then reference the
character id without repeating sprite details.

```ts
import { defineCharacter } from '@strange-path/engine'

export const playerCharacter = defineCharacter({
    id: 'player',
    sheet: 'player',
    frameSize: [32, 32],
    pivot: [16, 24],
    bodyBox: {
        size: [14, 26],
        offset: [0, -13],
    },
    sockets: {
        handMain: [20, -16],
        back: [3, -18],
    },
    clips: {
        idle: { frames: [0, 1, 2, 3], fps: 8, loop: true },
        run: { frames: [8, 9, 10, 11, 12, 13], fps: 12, loop: true },
        jump: { frames: [16], fps: 1, loop: false },
        fall: { frames: [17], fps: 1, loop: false },
        attack: { frames: [24, 25, 26, 27], fps: 16, loop: false },
        hurt: { frames: [32, 33], fps: 10, loop: false },
    },
})
```

### `src/content/equipment/red-cape.equipment.ts`

Equipment definitions should be additive. Adding a visual layer should not
require edits to the player entity, renderer internals, or main entrypoint.

```ts
import { defineEquipment } from '@strange-path/engine'

export const redCape = defineEquipment({
    id: 'red-cape',
    slot: 'back',
    layers: [
        {
            sheet: 'props',
            clip: 'redCape',
            socket: 'back',
            order: 'behind-body',
        },
    ],
})
```

### `src/content/characters/slime.character.ts`

Mob visuals use the same content path as the player. A mob entity should not
hardcode frame grids or clip timings.

```ts
import { defineCharacter } from '@strange-path/engine'

export const slimeCharacter = defineCharacter({
    id: 'slime',
    sheet: 'slime',
    frameSize: [24, 16],
    pivot: [12, 14],
    bodyBox: {
        size: [18, 12],
        offset: [0, -6],
    },
    clips: {
        idle: { frames: [0, 1, 2, 3], fps: 6, loop: true },
        hop: { frames: [8, 9, 10, 11], fps: 10, loop: true },
        hurt: { frames: [16, 17], fps: 10, loop: false },
    },
})
```

### `src/content/items/starter-items.ts`

Items own icon and pickup metadata plus typed effects. Systems apply effects to
gameplay interfaces; visual animation code should not contain item rules.

```ts
import { defineItem } from '@strange-path/engine'

export const starterItems = [
    defineItem({
        id: 'starter-cape',
        icon: { sheet: 'props', clip: 'redCapeIcon' },
        pickupSize: [14, 14],
        effects: [{ kind: 'equip', equipment: 'red-cape' }],
    }),
]
```

### `src/tilesets/cave.tileset.ts`

Adding a tile should mean giving a frame a name and attaching engine behavior to
it. Collision, interaction, rendering, and default sounds should live in the
tileset, not in scene code.

```ts
import { autotile4, defineTileset, oneWayTile, playSound, setTile, solidTile, tile } from '@strange-path/engine'

export const caveTileset = defineTileset({
    id: 'cave',
    atlas: 'cave',

    tiles: {
        empty: tile({ frame: [0, 0] }),
        stone: solidTile({ frame: [1, 0] }),
        stoneEdge: solidTile({ frame: [2, 0] }),
        platform: oneWayTile({ frame: [3, 0] }),

        crystalSwitchOff: solidTile({
            frame: [4, 0],
            interact: {
                action: 'interact',
                range: 24,
                prompt: 'Use',
                reactions: [playSound('tileInteract', { at: 'tile', bus: 'sfx' }), setTile('crystalSwitchOn')],
            },
        }),

        crystalSwitchOn: solidTile({
            frame: [5, 0],
            light: { radius: 48, color: '#78e6ff', intensity: 0.65 },
        }),

        spike: tile({
            frame: [6, 0],
            trigger: {
                kind: 'damage',
                amount: 1,
                knockback: [180, -260],
                sound: 'mobHit',
            },
        }),
    },

    rules: {
        stone: autotile4({
            source: 'stone',
            variants: {
                center: [1, 0],
                top: [1, 1],
                bottom: [1, 2],
                left: [0, 1],
                right: [2, 1],
                outerTopLeft: [0, 0],
                outerTopRight: [2, 0],
                outerBottomLeft: [0, 2],
                outerBottomRight: [2, 2],
            },
        }),
    },
})
```

### `src/entities/player.entity.ts`

Adding the player should be component-based, but the common side-view player
setup should still be short. The game should only customize numbers, sprite ids,
sound ids, and state behavior.

```ts
import {
    body,
    cameraTarget,
    characterAppearance,
    collider,
    defineActor,
    equipmentHolder,
    hurtbox,
    lightEmitter,
    playerController,
    playSound,
    stateChart,
    transform,
} from '@strange-path/engine'

export const player = defineActor({
    id: 'player',
    tags: ['player'],

    components: [
        transform(),

        body({
            layer: 'player',
            mass: 1,
            gravityScale: 1,
            friction: 0.82,
        }),

        collider({
            shape: 'aabb',
            size: [14, 26],
            offset: [0, -13],
        }),

        characterAppearance({
            character: 'player',
            clip: 'idle',
            zIndex: 10,
        }),

        equipmentHolder({
            slots: ['handMain', 'back'],
        }),

        playerController({
            maxSpeed: 155,
            acceleration: 1200,
            deceleration: 1600,
            jumpSpeed: 420,
            coyoteTicks: 6,
            jumpBufferTicks: 6,
            variableJump: true,
        }),

        hurtbox({
            size: [14, 24],
            offset: [0, -12],
            iFrameTicks: 40,
        }),

        lightEmitter({
            radius: 80,
            color: '#ffd38a',
            intensity: 0.45,
        }),

        cameraTarget({
            deadzone: [48, 24],
            lookAhead: [42, 0],
        }),
    ],

    states: stateChart({
        initial: 'idle',
        states: {
            idle: { clip: 'idle' },
            run: { clip: 'run' },
            jump: { clip: 'jump' },
            fall: { clip: 'fall' },
            attack: {
                clip: 'attack',
                timeline: [
                    { at: 1, reactions: [playSound('playerAttack', { at: 'self' })] },
                    { at: 4, event: 'hitbox.start', id: 'slash' },
                    { at: 8, event: 'hitbox.end', id: 'slash' },
                ],
            },
            hurt: { clip: 'hurt' },
        },
    }),

    hitboxes: {
        slash: {
            size: [22, 16],
            offset: [18, -16],
            damage: 1,
            knockback: [220, -80],
        },
    },
})
```

### `src/entities/mobs/slime.entity.ts`

Adding a mob should be the same composition pattern as the player, with AI as a
normal component or system input. Mob hit feedback should be a first-class
reaction, including sound.

```ts
import { applyKnockbackFromHit, body, characterAppearance, collider, defineActor, flashSprite, hurtbox, mobBrain, playSound, stateChart, transform } from '@strange-path/engine'

export const slime = defineActor({
    id: 'slime',
    tags: ['enemy', 'mob'],

    components: [
        transform(),
        body({ layer: 'enemy', mass: 0.6, gravityScale: 1 }),
        collider({ shape: 'aabb', size: [18, 12], offset: [0, -6] }),
        characterAppearance({ character: 'slime', clip: 'idle', zIndex: 9 }),

        hurtbox({
            size: [18, 12],
            offset: [0, -6],
            iFrameTicks: 20,
            onHit: [playSound('mobHit', { at: 'self', bus: 'sfx', pitchRange: [0.94, 1.06] }), flashSprite('#ffffff', { ticks: 4 }), applyKnockbackFromHit()],
        }),

        mobBrain({
            kind: 'patrol',
            speed: 45,
            noticeRange: 96,
            keepDistanceFromLedge: true,
        }),
    ],

    states: stateChart({
        initial: 'idle',
        states: {
            idle: { clip: 'idle' },
            patrol: { clip: 'hop' },
            chase: { clip: 'hop' },
            hurt: { clip: 'hurt' },
        },
    }),
})
```

### `src/entities/props/crate.entity.ts`

Props should be regular entities. If a crate uses interaction physics and hit
feedback, it should not need custom gameplay code.

```ts
import { body, collider, definePrefab, hurtbox, playSound, sprite, transform } from '@strange-path/engine'

export const crate = definePrefab({
    id: 'crate',
    tags: ['prop', 'pushable'],

    components: [
        transform(),
        body({
            layer: 'prop',
            mass: 2.5,
            gravityScale: 1,
            friction: 0.9,
            pushable: true,
        }),
        collider({ shape: 'aabb', size: [16, 16], offset: [0, -8] }),
        sprite({ sheet: 'props', clip: 'crate' }),
        hurtbox({
            size: [16, 16],
            offset: [0, -8],
            onHit: [playSound('crateHit', { at: 'self', bus: 'sfx' })],
        }),
    ],
})
```

### `src/scenes/debug-room.scene.ts`

Scenes should be easy to read. Small debug rooms can use ASCII maps. Larger
production maps can use imported data later, but the scene API should feel the
same.

```ts
import { asciiTilemap, defineScene, vec } from '@strange-path/engine'

import { slime } from '../entities/mobs/slime.entity'
import { player } from '../entities/player.entity'
import { crate } from '../entities/props/crate.entity'
import { caveTileset } from '../tilesets/cave.tileset'

export const debugRoom = defineScene({
    id: 'debug-room',
    title: 'Debug Room',

    tilesets: [caveTileset],

    create(world) {
        world.setBounds({ x: 0, y: 0, width: 960, height: 320 })

        world.addTilemap(
            asciiTilemap({
                id: 'terrain',
                tileset: 'cave',
                tileSize: 16,
                legend: {
                    '#': 'stone',
                    '=': 'platform',
                    i: 'crystalSwitchOff',
                    '^': 'spike',
                    '.': 'empty',
                },
                rows: [
                    '............................................................',
                    '............................................................',
                    '............................................................',
                    '..............====..........................................',
                    '............................................................',
                    '.............................####...........................',
                    '............................................................',
                    '...........i................................................',
                    '############################################################',
                ],
            }),
        )

        const hero = world.spawn(player, { at: vec(80, 112) })

        world.spawn(crate, { at: vec(320, 112) })
        world.spawn(slime, {
            at: vec(680, 112),
            props: {
                patrol: {
                    from: vec(600, 112),
                    to: vec(760, 112),
                },
            },
        })

        world.camera.follow(hero)

        world.debug.addRoomControls({
            toggles: ['colliders', 'contacts', 'hitboxes', 'lights', 'spatialHash'],
            actions: {
                reset: () => world.reloadScene(),
                spawnCrate: () => world.spawn(crate, { at: world.pointer.worldPosition() }),
                knockPlayer: () => world.physics.applyImpulse(hero, vec(240, -220)),
                playTileSound: () => world.audio.play('tileInteract', { at: hero }),
            },
        })
    },
})
```

## Happy Path Snippets

### Add a character sprite

```ts
export const assets = defineAssets({
    images: {
        bat: image('sprites/bat.png'),
    },
    sprites: {
        bat: spriteSheet('bat', {
            image: 'bat',
            frameSize: [24, 24],
            pivot: [12, 18],
            clips: {
                fly: { frames: [0, 1, 2, 3], fps: 12, loop: true },
                hurt: { frames: [8, 9], fps: 10, loop: false },
            },
        }),
    },
})

export const batCharacter = defineCharacter({
    id: 'bat',
    sheet: 'bat',
    frameSize: [24, 24],
    pivot: [12, 18],
    clips: {
        fly: { frames: [0, 1, 2, 3], fps: 12, loop: true },
        hurt: { frames: [8, 9], fps: 10, loop: false },
    },
})
```

### Add a sound

```ts
export const assets = defineAssets({
    sounds: {
        gemPing: sample('audio/gem-ping.ogg'),
    },
})
```

### Add a tile that plays sound on interact

```ts
export const caveTileset = defineTileset({
    id: 'cave',
    atlas: 'cave',
    tiles: {
        gemSwitch: solidTile({
            frame: [7, 0],
            interact: {
                action: 'interact',
                range: 24,
                reactions: [playSound('gemPing', { at: 'tile' }), setTile('gemSwitchOn')],
            },
        }),
    },
})
```

### Place a tile in a scene

```ts
world.tilemap('terrain').setTile({ x: 12, y: 8 }, 'gemSwitch')
```

### Add a mob that plays sound on hit

```ts
export const bat = defineActor({
    id: 'bat',
    tags: ['enemy', 'flying'],
    components: [
        transform(),
        body({ layer: 'enemy', gravityScale: 0 }),
        collider({ shape: 'aabb', size: [16, 12] }),
        characterAppearance({ character: 'bat', clip: 'fly' }),
        hurtbox({
            size: [16, 12],
            onHit: [playSound('mobHit', { at: 'self', pitchRange: [0.9, 1.1] })],
        }),
        mobBrain({ kind: 'hover-chase', speed: 70, noticeRange: 140 }),
    ],
})
```

### Spawn a mob

```ts
world.spawn(bat, { at: [420, 80] })
```

## Reference Engines

Use these as references for future decisions, not as a list of dependencies to
copy wholesale.

- [Deno](https://docs.deno.com/) for the runtime, TypeScript execution, secure
  permissions, tasks, testing, formatting, linting, and desktop executable
  compilation.
- [raylib](https://www.raylib.com/) for code-first simplicity, minimal ceremony,
  direct game loops, and no required editor.
- [LÖVE](https://www.love2d.org/wiki/Main_Page) for small lifecycle callbacks,
  file-based projects, approachable 2D APIs, and cross-platform packaging.
- [DragonRuby Game Toolkit](https://docs.dragonruby.org/) for code-first project
  structure, fast iteration, practical 2D APIs, and shippable desktop builds.
- [HaxeFlixel](https://haxeflixel.com/documentation/) for sprites, animation,
  state management, tilemaps, cameras, collision helpers, and 2D debug tooling.
- [Phaser](https://docs.phaser.io/phaser/getting-started/what-is-phaser) for
  asset loading, scene lifecycle, sprites, tweens, input mapping, and tilemaps.
  Borrow API ideas, not browser coupling.
- [Bevy ECS](https://bevy.org/learn/quick-start/getting-started/ecs/) for
  data-driven composition, schedules, plugins, resources, and systems.
- [tModLoader](https://docs.tmodloader.net/docs/stable/class_mod_item.html) for
  explicit content registration, one-module-per-content patterns, and typed item
  hooks. Borrow the additive content model, not Terraria-specific inheritance.
- [Godot best practices](https://docs.godotengine.org/en/stable/getting_started/workflow/best_practices/index.html)
  for reusable scene/prefab thinking, resource organization, and signals/events.
  Borrow composition ideas, not editor dependency.
- [MonoGame](https://docs.monogame.net/) and FNA-style architecture for explicit
  game loops, content pipelines, platform abstraction, and cross-platform 2D.
- [Heaps.io](https://heaps.io/documentation/home.html) for code-first graphics
  architecture, resource handling, and high-performance game structure.
- [Tiled JSON](https://doc.mapeditor.org/en/latest/reference/json-map-format/)
  for optional map interchange later. Do not require an editor for the simple
  code-first path.
- [Matter.js](https://brm.io/matter-js/docs/) and Box2D-family APIs for physics
  vocabulary, collision events, and debug views. Do not copy full rigid-body
  scope unless the engine direction changes.
- [PixiJS renderers](https://pixijs.com/8.x/guides/components/renderers) for
  renderer abstraction, batching, scene graph tradeoffs, and graphics backend
  design.

## Best Practices To Borrow

- Keep the entrypoint tiny and boring.
- Put all content in normal source files or asset folders.
- Define assets by stable ids, then reference ids from scenes, entities, tiles,
  sounds, and reactions.
- Define characters, equipment, and items through content modules that register
  at startup and validate before rendering.
- Resolve content into runtime handles once; avoid stringly-typed lookups inside
  hot loops.
- Use scenes as isolated modules with clear lifecycle.
- Use prefabs/actors for spawnable objects.
- Use components for reusable behavior and small systems for cross-entity logic.
- Keep fixed-timestep simulation separate from rendering.
- Make audio event-driven: play sounds from interactions, combat events, state
  timelines, and triggers, not from rendering.
- Treat tile interaction as an engine feature: action prompt, range check,
  reaction list, sound, state change, and debug visibility.
- Treat hit feedback as an engine feature: damage, knockback, hitstop, flash,
  sound, i-frames, and event logging.
- Validate asset ids and scene definitions before the first frame.
- Make debug overlays available for every engine-owned system.
- Keep platform APIs behind adapters so desktop packaging is not a rewrite.

## What The Engine Should Own

- Deno runtime integration and platform adapter contracts.
- Window, renderer, audio, input, storage, clock, and debug UI interfaces.
- Fixed timestep and lifecycle.
- Asset loading and validation.
- Sprite sheets, animation clips, timelines, and runtime animators.
- Content registry, character definitions, equipment definitions, item
  definitions, and resolved character appearances.
- Tile atlases, tilemaps, collision extraction, interaction, and optional
  autotiling.
- Entity world, component storage, queries, spawning, and despawning.
- Side-view physics, contacts, triggers, platforms, and interaction responses.
- Input sources, action mapping, buffering, recording, and replay.
- Audio buses, spatial sound, sound variation, and event-based playback.
- Camera, screen shake, world/screen transforms, and bounds.
- Rendering layers, offscreen buffers, lighting, and debug overlays.
- Diagnostics, performance counters, scene reload, and debug UI hooks.

## What Game Code Should Own

- Asset ids and paths.
- Character ids, frame layouts, sockets, sprite clip names, and frame ranges.
- Equipment slots, equipment visual layers, item icons, pickup sizes, and typed
  item effects.
- Sound names and intended gameplay events.
- Tile names and visual theme choices.
- Tile-specific reactions when engine defaults are not enough.
- Entity and prefab definitions.
- Scene composition.
- Tuning values for movement, physics, combat, AI, lighting, and audio.
- Game-specific systems when engine defaults are not enough.
- Actual game content, once the engine is ready for it.

## API Shape To Prefer

Prefer this:

```ts
world.spawn(slime, { at: [240, 120] })
world.tilemap('terrain').setTile({ x: 10, y: 14 }, 'stone')
world.audio.play('tileInteract', { at: [160, 112] })
world.physics.applyImpulse(playerId, [220, -120])
```

Avoid this:

```ts
const entity = new Entity()
entity.components.push(new TransformComponent())
entity.components.push(new BodyComponent())
entity.components.push(new SpriteComponent())
world.entities.push(entity)
```

Also avoid this in game code:

```ts
document.querySelector('canvas')
window.requestAnimationFrame(update)
new AudioContext()
localStorage.setItem('debug', 'true')
```

The engine can use classes and platform APIs internally, but user-facing APIs
should make the common path short, typed, portable, and hard to misuse.

## Debug Expectations

Every north-star API should have a matching way to inspect it:

- Platform: runtime, adapter, window state, renderer backend, audio backend, and
  input backend.
- Sprites: current sheet, clip, frame, playback speed, and animation events.
- Content: registered characters, equipment, items, resolved appearances,
  sockets, visual layers, and validation errors.
- Sounds: sample id, bus, volume, pitch, spatial position, and recent play
  events.
- Tiles: tile id, collision type, interaction range, autotile mask, chunk id,
  and dirty state.
- Tile interactions: actor, tile position, action, reaction list, sound, and
  result.
- Entities: id, tags, components, enabled state, and current system state.
- Physics: bodies, colliders, contacts, normals, impulses, and broad-phase cells.
- Input: physical input, mapped actions, buffered actions, and replay state.
- Combat: hitboxes, hurtboxes, active frames, hit events, hitstop, sounds, and
  i-frames.
- Lighting: lights, occluders, rays, visibility polygons, and buffer timing.

## Deferred Editor-Like Features

These can exist later, but should not be required for the clean code-first path:

- Tile painting UI.
- Sprite clip editor.
- Scene graph editor.
- Collision shape editor.
- Timeline editor.
- Visual behavior tree editor.
- Runtime inspector that mutates scene files.

The engine should remain pleasant without any of these.
