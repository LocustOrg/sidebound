# Roadmap

## Roadmap Intent

This project is an engine project first.

`@sidebound/engine` is the product being built. `packages/game` is only a
demo harness used to refactor, debug, profile, and prove engine behavior on a
real runtime surface. It should not become the game yet.

The demo harness may contain placeholder art, temporary rooms, test actors, and
debug controls, but only to validate engine APIs. Avoid lore, progression,
inventory, quests, procedural content, polished level design, or any feature
whose main purpose is to make the demo feel like a finished game.

## Active Work

The roadmap starts from remaining engine work only:

- Fixed-step lifecycle and deterministic simulation.
- SDL3 texture loading, source-free texture handles, render targets, and blend
  behavior.
- SDL3 game runtime wiring and compile/package automation.
- Engine-owned entity, component, physics, collision, interaction, and combat
  systems.
- Runtime world travel, chunk streaming, validation depth, and persistence.
- Tests, profiling, diagnostics, and package/compile automation.

## Runtime Policy

SDL3 is the primary runtime and renderer target. Browser preview is temporary
migration scaffolding, not a parallel product surface. Do not add new browser
renderer features; only keep the preview working long enough to compare behavior
while SDL3 reaches debug-room parity.

## SDL3 Cutover Milestones

1. Implement SDL3 texture loading, `drawTexture`, render targets, and blend
   behavior needed for sprites, UI/debug overlays, and basic lighting.
2. Convert game terrain, entity effects, debug, background, and lighting
   layers to `Renderer2D` commands or SDL3-compatible textures.
3. Add an SDL3 game entrypoint that runs the debug room with movement, camera,
   collision, sprites, item pickups, and collision debug.
4. ~~Move browser-only debug panel, minimap, and audio behind platform services or
   drop them from the SDL3 milestone until platform replacements exist.~~ Done.
5. ~~Make SDL3 the default `dev` task and keep browser preview only as a temporary
   migration task.~~ Done — SDL3 is the sole `dev` task.
6. ~~Delete the browser renderer after SDL3 parity and compile/package smoke
   coverage.~~ Done — `packages/platform-browser` removed.

## Phase Rules

Every phase should produce three things:

- Engine API: reusable code exported from `@sidebound/engine`.
- Demo harness proof: a small scenario in `packages/game` that exercises the API.
- Debug visibility: enough overlay, logging, counters, or controls to make the
  system refactorable.

Do not add game content unless it directly proves an engine feature. Prefer
small, artificial test rooms over authored gameplay.

---

## Phase 1 - Time, Lifecycle, and Determinism

Make simulation timing explicit before adding more systems.

### Engine Deliverables

- `FixedTimestep` with accumulator-based simulation at 60 Hz by default.
- Configurable max updates per rendered frame, defaulting to 4.
- Separate lifecycle callbacks: `beforeUpdate`, `update`, `afterUpdate`,
  `render`, `afterRender`.
- Pause, resume, single-step, and slow-motion controls at the loop level.
- Interpolation support for rendering between simulation states.
- Deterministic tick counter exposed to systems and diagnostics.
- Runtime assertions or warnings when gameplay code tries to use raw frame delta.

### Demo Harness Proof

- Debug panel can pause, resume, step one tick, and run slow motion.
- Movement and gravity behave the same at 60 Hz, 120 Hz, and throttled frame
  rates.
- Render interpolation keeps visual motion smooth while simulation remains fixed.
- Debug overlay shows frame dt, sim tick, accumulated time, update count, and
  dropped-update warnings.

### Done When

The demo simulation is deterministic at fixed 60 Hz regardless of display refresh
rate, and timing behavior is visible enough to debug.

---

## Phase 2 - Rendering, Assets, and Camera

Turn rendering from demo code into a reusable side-view rendering module.

### Engine Deliverables

- Stable layer order: background, terrain, entities, lighting, particles/FX, UI,
  debug.
- `Renderer2D`/`RenderFrame` commands with surface size, camera transform,
  elapsed time, and debug flags.
- Offscreen render-target helpers for cached terrain and light buffers.
- Dirty tracking hooks for layers that can avoid full redraws.
- Pixel-perfect scaling and camera snapping rules.
- Asset loader for images, sprite sheets, texture atlas layouts, sounds, and JSON
  sprite manifests.
- Startup validation for duplicate content ids, missing asset references, invalid
  frame indices, unknown equipment references, and incompatible atlas sizes.
- Startup validation for duplicate region/location ids, broken connection
  targets, missing spawn points, invalid chunk paths, and unknown tile ids.
- Camera APIs for follow target, look-ahead, deadzone, bounds, shake, and world
  to screen conversion.
- Basic render stats: draw calls where measurable, layer timings, cache hits,
  surface dimensions, and pixel scale.

### Demo Harness Proof

- One debug screen shows all render layers toggled independently.
- Camera can follow the player, clamp to room bounds, lead horizontally, and
  shake from a test button.
- Terrain can be cached offscreen and invalidated from debug controls.
- Sprite/content definitions load through `ContentRegistry` instead of being
  hardcoded in the demo.

### Done When

Rendering is engine-owned, the demo only supplies assets and layer instances, and
rendering behavior can be inspected layer by layer.

---

## Phase 3 - Input and Action Mapping

Separate physical inputs from gameplay intent.

### Engine Deliverables

- Keyboard and gamepad input sources behind one `InputManager`.
- `InputFrame` snapshot consumed once per fixed tick.
- Action mapping layer (`left`, `right`, `jump`, `attack`, `dodge`, `interact`,
  `debugToggle`, etc.).
- Analog deadzone and axis normalization.
- Input buffering for actions such as jump, attack, dodge, and interact.
- Edge detection: pressed, held, released, repeated.
- Optional vibration API for supported gamepads.
- Input recording and replay format for debugging deterministic behavior.

### Demo Harness Proof

- Debug panel shows live physical inputs and mapped actions.
- Keyboard and gamepad can both drive the same player controller.
- Buffered jump or attack can be verified with a tiny timing test.
- A recorded input sequence can replay the same movement path.

### Done When

Player control uses action frames from the engine, not direct platform events, and
input can be recorded, inspected, and replayed.

---

## Phase 4 - Entity World and Components

Introduce a lightweight world model before adding deeper physics and combat.

### Engine Deliverables

- `Entity` identity: id, name/debug label, tags, enabled flag, and lifecycle.
- `World` manager: `spawn()`, `despawn()`, `get()`, `query()`, `forEach()`, and
  deferred mutation during system updates.
- Component storage for common components without committing to a heavy ECS
  framework.
- Core components: `Transform`, `PhysicsBody`, `Sprite`, `AnimatorState`,
  `CharacterAppearance`, `EquipmentHolder`, `Controller`, `LightEmitter`, and
  `DebugLabel`.
- `System` interface with fixed update ordering.
- Entity pooling hooks for future hot-path optimization.
- Serialization-friendly entity definitions for demo fixtures.
- Debug entity inspector with counts, tags, components, and selected entity data.

### Demo Harness Proof

- Player becomes an entity with transform, physics, character appearance, and
  controller data.
- Test blocks, crates, lights, and debug markers are spawned from data.
- Entity render layer draws from world queries instead of hardcoded arrays.
- Debug panel can select an entity and inspect its component state.

### Done When

The demo scene is built from engine entities and components, and systems operate
on world queries rather than demo-specific objects.

---

## Phase 5 - Collision and Interaction Physics

Build the engine's defining feature: tangible side-view interaction physics.

### Engine Deliverables

- `PhysicsBody` component with mass, friction, restitution, gravity scale,
  kinematic flag, platform flag, and collision layer.
- `Collider` shapes, starting with AABB and segment/static terrain support.
- `SpatialHash` broad phase with configurable cell size, defaulting to 64 px.
- `PhysicsWorld.step(dt)`: broad phase, narrow phase, contact generation,
  response, and post-step events.
- Collision layer matrix with response types: block, push, bounce, ride,
  trigger, and ignore.
- Grounding and surface data: normal, slope policy, platform velocity, and
  contact duration.
- One-way platforms and pass-through rules.
- Moving platforms that carry riders.
- Pushable bodies with mass ratios.
- Knockback and impulse helpers.
- Trigger volumes and contact event stream.
- Physics debug overlay for bodies, broad-phase cells, contact normals, and
  collision pairs.

### Demo Harness Proof

- Player can stand on terrain, jump, fall, and collide without tunneling in the
  expected speed range.
- Player can push a crate.
- Player can ride a moving platform.
- Two dynamic entities can bounce.
- Trigger volume logs enter, stay, and exit events.
- A knockback test source applies directional impulse.

### Done When

Interaction physics is reusable from the engine and the demo can visibly prove
push, ride, bounce, trigger, one-way platform, and knockback behavior.

---

## Phase 6 - Lighting and Visibility

Move ray lighting into the engine as a debuggable rendering and query system.

### Engine Deliverables

- Point lights with radius, color, intensity, falloff, and dirty state.
- Occluder model generated from static terrain, dynamic bodies, or explicit
  segments.
- Spatial partitioning for ray queries.
- Cached static occluder geometry with invalidation.
- Lower-resolution light buffer composited into the main scene.
- Ambient light and per-layer composition settings.
- Light culling by camera viewport and bounds.
- Debug views for rays, occluders, light bounds, visibility polygons, and mask
  buffers.

### Demo Harness Proof

- Static walls block a moving point light.
- Dynamic crate or entity can optionally act as an occluder.
- Debug controls can toggle occluders, rays, light buffers, and ambient level.
- Lighting stats show ray count, occluder count, and light pass timing.

### Done When

Lighting is engine-owned, performant enough for the demo scene, and transparent
enough to debug geometry mistakes.

---

## Phase 7 - World Locations, Travel, and Chunked Maps

Make large worlds clean by splitting them into regions, locations, connections,
and chunks.

### Engine Deliverables

- `defineWorld`, `defineRegion`, and `defineLocation`.
- `connection()` and `edgeConnection()` helpers.
- Connection kinds: edge, door, ladder, portal, fall, debug.
- Spawn point registry per location.
- `TravelSystem` with `world.travel.to()` and `world.travel.follow()`.
- Transition hooks: none, fade, pan, and custom transition.
- `chunkedTilemap()` with chunk size, preload radius, unload radius, static
  render caching, collision caching, and lighting occluder caching.
- Validation for regions, locations, spawn points, connection targets, reciprocal
  links when configured, chunk paths, tile ids, and trigger bounds.
- Persistence hooks for visited locations, unlocked connections, flags, and
  persistent entity state overrides.
- Debug overlay for location bounds, spawn points, connection triggers, target
  labels, loaded chunks, and travel state.

### Demo Harness Proof

- Two or three artificial locations are connected by edge and door connections.
- Player can travel between locations and land at the correct spawn point.
- One location uses chunked map data larger than the viewport.
- Debug overlay shows loaded chunks, connection triggers, and current location.
- Validation catches one intentionally broken debug-only connection in a test.

### Done When

The demo can move between locations through engine-owned travel, and a large
chunked map stays readable because tile data lives outside gameplay code.

---

## Phase 8 - Animation, State, and Feel

Make gameplay timing data explicit and separate it from visual animation.

### Engine Deliverables

- Animation graph or state machine primitives for side-view actors.
- Data-driven clips with frame duration, loop policy, tags, and events.
- Character appearance rendering with layered equipment, sockets, and resolved
  atlas handles.
- Gameplay event timeline independent of rendered sprite frames.
- Actor controller helpers for acceleration, deceleration, coyote time, jump
  buffer, variable jump height, and wall/platform policies.
- State debugging: current state, previous state, elapsed frames, transition
  reason, and queued actions.
- Event hooks for footstep, landing, jump, attack-start, active-frame, recovery,
  and custom timeline events.

### Demo Harness Proof

- Player movement states are visible in the debug overlay.
- Sprite animation follows state without owning gameplay timing.
- Jump buffer and coyote time can be toggled or tuned live.
- Animation events can spawn a temporary visual marker or debug log entry.

### Done When

The demo player feels responsive because of engine-level controller primitives,
and state/timing decisions are inspectable frame by frame.

---

## Phase 9 - Combat Primitives

Add combat as an engine framework, not as final game design.

### Engine Deliverables

- `HitboxComponent` with local rect, active frame range, damage payload,
  knockback vector, owner id, and collision layer.
- `HurtboxComponent` with local rect, receiver filters, i-frame timer, and
  enabled state.
- `CombatSystem` that checks hitbox and hurtbox overlap through spatial data.
- Hit events with attacker, defender, hitbox id, hurtbox id, point, normal, and
  payload.
- Hitstop that can freeze attacker, defender, or world groups for N ticks.
- I-frame helpers and repeated-hit suppression.
- Stagger accumulation and stagger-break hooks.
- Attack timeline helpers: windup, active, recovery, cancel windows.
- Combat debug overlay for hitboxes, hurtboxes, active frames, i-frames, and
  hit events.

### Demo Harness Proof

- Player has one placeholder attack with visible active frames.
- Test dummy receives damage, knockback, hitstop, and temporary i-frames.
- Repeated-hit suppression can be verified by holding an overlapping hitbox.
- Debug overlay shows all active combat boxes and recent hit events.

### Done When

The engine can express basic side-view hitbox combat, and the demo validates the
framework without becoming a real combat game.

---

## Phase 10 - Engine DX, Testing, and Tooling

Make the engine easier to use, refactor, and trust.

### Engine Deliverables

- `createEngine()` factory that wires loop, renderer, input, world, physics,
  camera, assets, and debug options from one config object.
- Stable package exports grouped by subsystem.
- Headless tests for math, fixed timestep, input buffering, entity queries,
  collision, world validation, travel, combat overlap, and serialization.
- Deno/platform smoke test for the demo harness.
- Debug settings persisted through platform storage.
- Minimal profiling helpers for subsystem timing and allocation-sensitive paths.
- Error boundaries or fatal-error reporting for demo boot failures.
- Starter world/location/data format documented by example.
- Public API notes for each subsystem as it stabilizes.

### Demo Harness Proof

- Demo boot code is small and mostly declarative.
- A new test location or debug scene can be added without changing engine
  internals.
- CI can typecheck, lint, run headless tests, and build the demo.
- Debug panel can reset the current test location or debug scene, switch test
  rooms, and export/import a small diagnostic snapshot.

### Done When

A new demo can be bootstrapped quickly with engine APIs, and refactoring engine
internals is protected by tests and platform smoke coverage.

---

## Phase 11 - Deferred Game Layer

Only start real game iteration after the engine has passed the earlier phases.
This phase is intentionally not the current focus.

Candidate game-layer features:

- Tilemap authoring and auto-tiling using engine collision and rendering APIs.
- Production room/chunk transitions and persistent world flags built on the
  engine location graph.
- Enemy AI built on engine FSM, physics, and combat primitives.
- Boss framework with arenas, phase changes, telegraphs, and pattern selection.
- Inventory, progression, pickups, economy, or loot.
- Save/load format for actual game state.
- Audio direction beyond engine primitives: music identity, sound palette, mix.
- Polished UI, menus, settings, pause flow, and accessibility pass.
- Real content pipeline: sprites, maps, animation data, and tuning data.
- Narrative, lore, quest, biome, or world-building work.

### Done When

The engine is good enough that game features can be implemented as users of the
engine, not as hidden engine work inside the game package.

---

## Success Metric

The engine is ready for real game iteration when a developer can:

1. Start from a small `@sidebound/engine` setup.
2. Define a side-view world with regions, locations, chunked maps, connections,
   spawn points, a player entity, physics, lighting, animation, and combat.
3. Inspect timing, rendering, input, world travel, chunk loading, physics,
   lighting, entities, and combat from debug tools.
4. Build a playable ARPG or roguelite prototype within an afternoon using engine
   APIs instead of copying demo code.

Until then, `packages/game` remains a demo harness for making the engine better.
