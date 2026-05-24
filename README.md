# Sidebound

![Sidebound engine logo](assets/brand/sidebound-engine-logo.png)

Sidebound is a code-first 2D side-view pixel-art engine for ARPG, roguelike,
and roguelite games. The project is engine-first: `packages/engine` is the
product, while `packages/game` is a demo and debugging harness used to validate
engine APIs.

The engine direction is Deno-first, desktop-friendly, and built around clean
TypeScript files instead of an editor-only workflow. Browser preview can exist
as a development adapter, but gameplay, simulation, rendering abstractions,
audio, input, storage, and tooling should be portable outside the browser.

## Focus

- Side-view-only physics, camera, collision, combat, lighting, and pathfinding.
- Interaction physics: push, ride, bounce, hook, stack, trigger, and knockback.
- Code-first content definitions for sprites, equipment, items, tiles, mobs, and
  players.
- Region, location, connection, and chunked-map architecture for clean large
  worlds.
- Debug visibility for rendering, physics, lighting, input, entities, and world
  travel.

## Workspace

- `packages/engine` - reusable Sidebound engine systems.
- `packages/game` - temporary demo/debug harness for engine refactoring.
- `agents` - project notes, roadmap, target engine API, and architecture docs.
- `assets/brand` - logo and repository visibility assets.

## Current Commands

```sh
pnpm install
pnpm dev
pnpm check
pnpm build
```

## Direction

The demo harness should stay small and artificial until the engine is strong
enough. Real game content, lore, progression, quests, and polished level design
come later; the immediate goal is a clean, testable engine with strong
debugging, validation, and platform boundaries.
