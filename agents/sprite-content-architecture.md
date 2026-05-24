# Sprite Content Architecture

The sprite pipeline should behave like an engine feature, not demo plumbing.
Characters, equipment, and items are content that register with the engine; render
systems consume loaded appearances and resolved asset handles.

## Principles

- Keep sprite rendering canvas-first and pixel-crisp.
- Keep simulation state separate from render state.
- Resolve content, assets, frame layouts, and equipment layers during startup.
- Avoid stringly-typed lookups inside hot render loops.
- Make new content additive: adding an item or equipment piece should not require
  changes to `PlayerMob`, `ItemSystem`, `main.ts`, or renderer internals.
- Keep gameplay rules in systems and content effects, not in visual animation code.

## Engine Responsibilities

`packages/engine` owns reusable primitives:

- `AssetStore` for preloadable image assets.
- `TextureAtlasLayout` and `SpriteSheet` for frame lookup and drawing.
- `AnimationClip` and `SpriteAnimator` for frame progression.
- `ContentRegistry` plus `defineCharacter`, `defineEquipment`, and `defineItem`
  helpers for startup-time content registration.
- `CharacterRenderer` and `CharacterAppearance` for deterministic paper-doll
  layering.

## Game Responsibilities

Game packages own content modules and gameplay systems:

- Character definitions: atlas, frame grid, hitbox, sprite offset, clips, sockets.
- Equipment definitions: slot and visual layers.
- Item definitions: icon, pickup size, and typed effects.
- Factories that turn registered item IDs into world entities.
- Systems that apply effects to gameplay interfaces such as `EquipmentHolder`.

## Registration Lifecycle

1. Content modules export definitions through `define*` helpers.
2. A game content index registers every definition with `ContentRegistry`.
3. Startup validates duplicate IDs, missing asset references, invalid frame
   indices, unknown equipment references, and incompatible atlas sizes.
4. `AssetStore` preloads all referenced images.
5. Factories build resolved runtime objects (`CharacterAppearance`, pickup
   entities) from registry data and loaded assets.
6. Render systems draw resolved appearances; they do not inspect raw content
   modules or perform asset lookup per frame.

## Borrowed Patterns

- Bevy separates image assets, texture atlas layouts, sprite components, and
  animation systems. Follow the same separation: image URL, frame layout,
  animation state, and draw call are distinct concepts.
- tModLoader makes content registration explicit and local to each content type.
  Follow that model with one small module per character, item, or equipment piece.

## Content Module Shape

Prefer files such as:

- `content/characters/player.ts`
- `content/equipment/red-cape.ts`
- `content/equipment/iron-sword.ts`
- `content/items/starter-items.ts`
- `content/index.ts`

Each content file should be understandable in isolation and should not mutate
global game state at import time. Registration belongs in the content index.
