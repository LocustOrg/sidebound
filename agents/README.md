# Sidebound Agent Notes

These notes are the working memory for agents contributing to `sidebound`.
Read them before making engine or demo changes.

## Files

1. `engine.md` — what the engine is, its constraints, mandatory systems, and implementation rules.
2. `roadmap.md` — what to build next, in priority order.
3. `sprite-content-architecture.md` — sprite assets, content registration, and character/item architecture.
4. `world-location-architecture.md` — regions, locations, connections, chunked maps, travel, and validation.
5. `north-star-engine.md` — the target Deno-first, code-first developer experience and ideal API shape.
6. `deno-sdl-migration.md` — active migration plan from browser preview to a Deno + SDL3 runtime.

## Active Focus

The next agents should focus on fixed-step lifecycle, SDL3 texture loading and
`drawTexture`, converting the remaining browser-local demo render effects to
`Renderer2D`, wiring the SDL3 runtime into the demo, and moving
entity/physics/combat systems out of `packages/game` only when the engine API is
ready.

## Runtime Policy

SDL3 is the primary runtime goal. The browser renderer is temporary scaffolding:
keep it compiling while SDL3 reaches debug-room parity, but do not add new
browser-renderer features or shape engine APIs around Canvas2D.

## Default Behavior

All tasks are engine development tasks. Focus on `packages/engine` and
`packages/game`. `packages/game` is a demo/debug harness until the engine
roadmap through Phase 10 is complete. No real game content, world lore,
narrative work, progression, inventory, quests, or polished level design before
Phase 11.
