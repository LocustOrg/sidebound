# Engine

## Identity

`sidebound` is an open-source 2D side-view pixel-art engine built for
**ARPG, Roguelike, and Roguelite** games. The primary differentiator is
**interaction physics** — entities pushing, riding, bouncing off, hooking to, and
stacking on each other — rather than destruction physics or full rigid-body
simulation.

The engine should power games that feel responsive, juicy, and physically
tangible. Think Risk of Rain (Returns) rendering style with Hollow Knight–level
movement precision.

## Fixed Constraint

The engine is **side-view only**. All physics, camera, collision, enemy behavior,
combat, lighting, and pathfinding assume a side-view world.

Do not build top-down, three-quarter, isometric, or hybrid movement systems.

## Active Architecture Gaps

- Fixed timestep and lifecycle controls.
- Engine-owned entity, component, physics, collision, interaction, and combat
  systems.
- SDL-safe sprite, lighting, diagnostics, and render-target paths that do not
  rely on Canvas2D preview types.
- Platform audio, storage-backed debug settings, and non-DOM debug UI.
- Game demo boot through SDL3, followed by browser renderer deletion.

## Mandatory Systems

### Rendering

- 2D renderer behind an engine-owned interface.
- SDL3 is the primary renderer target. Browser canvas exists only as temporary
  migration scaffolding; game code never depends on canvas or DOM APIs directly.
- Layered pipeline: background → terrain → entities → lighting → particles/FX → UI/HUD → debug.
- Each layer implements `RenderLayer` interface with optional dirty tracking.
- Pixel-art scaling must stay crisp (nearest-neighbor).
- Offscreen render targets for light masks and cached terrain.
- No per-frame garbage in hot paths; batch and cache where measurable.
- Use libraries when they materially improve rendering, batching, or lighting.

### Content & Appearance

- `AssetStore` owns preloadable image, atlas, sprite, and sound assets.
- `TextureAtlasLayout`, `SpriteSheet`, `AnimationClip`, and `SpriteAnimator`
  are separate concepts.
- `ContentRegistry` validates startup content definitions.
- `defineCharacter`, `defineEquipment`, and `defineItem` register game content
  without mutating global state at import time.
- `CharacterRenderer` draws resolved `CharacterAppearance` data with
  deterministic paper-doll layering.
- Render systems consume resolved handles, not raw content modules or string
  lookups in hot loops.

### Entity System

- Lightweight entity pool with spawn/despawn/query-by-tag.
- Component composition: `PhysicsBody`, `Sprite`, `StateMachine`, `Hitbox`, `Hurtbox`.
- System interface: `update(entities, dt)`.
- No heavy ECS framework — tagged pool now, typed arrays for hot systems later.

### World Structure

- World structure follows `world-location-architecture.md`.
- `defineWorld` owns regions and the starting location/spawn.
- `defineRegion` groups related locations and shared defaults.
- `defineLocation` owns bounds, spawn points, chunked tilemaps, authored
  entities, and connections.
- Connections are typed graph edges: edge, door, ladder, portal, fall, debug.
- Chunked tilemaps keep large maps in data files and stream/render/cache near the
  camera.
- Engine validation catches broken location ids, spawn ids, connection targets,
  chunk paths, tile ids, and invalid spawn/trigger placement before first frame.
- Travel is engine-owned; player/controller code should not manually load
  locations.

### Interaction Physics

- `PhysicsBody`: position, velocity, mass, restitution, friction, collision layers.
- `PhysicsWorld.step(dt)`: spatial-hash broad phase → AABB narrow phase → response.
- Collision layers: `PLAYER`, `ENEMY`, `PROJECTILE`, `PLATFORM`, `ITEM`, `TRIGGER`.
- Response types per layer pair: push, bounce, ride, trigger-only, ignore.
- Features: push/block, ride/carry, bounce, knockback impulse, one-way platforms, conveyor/wind zones.

### Combat Framework

- Hitbox/hurtbox as first-class debug-visible objects.
- Attack phases: `windup → active → recovery`.
- Hitstop (freeze both attacker and target for N frames).
- Invincibility frames on dodge/hit.
- Knockback as interaction-physics impulse.
- Stagger accumulation and stagger-break.
- Clear separation between visual animation and gameplay timing data.

### Camera

- Smooth-damp follow with horizontal lead and combat-readable deadzone.
- Screen shake: amplitude, frequency, decay.
- Pixel-perfect rendering (round to integer positions).
- Boss arena framing support.

### Input

- Keyboard + gamepad + touch abstraction.
- Single `PlayerInputFrame` consumed per tick.
- Input buffering for attack/dodge queuing.
- Deadzone handling for analog sticks.
- Vibration on hit (where supported).

### Ray-Based Lighting

- Point lights blocked by walls, terrain, and large objects.
- Spatial partitioning for ray queries (grid or BVH).
- Cached static occluder geometry; dirty flags for moved lights.
- Lower-resolution light buffer composited into the main scene.
- Offscreen render targets for masks and compositing.
- Debug: show ray hits, occluders, light bounds, visibility masks.

### Audio

- Sample playback (`.ogg`/`.mp3`) via engine audio buffers.
- Spatial panning based on entity-to-camera distance.
- Music layer with crossfade.
- Oscillator fallback for placeholder sounds.

### Debug & Diagnostics

- Frame rate, frame time graph, simulation time, render time, subsystem timings.
- Entity counts, draw counts, collision checks, ray counts.
- Toggle: collision boxes, hitboxes/hurtboxes, lighting debug, AI state labels.
- Controls: pause, step one frame, slow motion, restart state.
- Memory signals and engine-owned estimates (pool usage, resource cache sizes).
- Persist debug settings through platform storage.

## Implementation Rules

- Engine code targets Deno-compatible TypeScript first; native browser APIs stay
  behind temporary preview adapters until the browser renderer is removed.
- A platform adapter owns the window, renderer surface, input source, audio
  backend, storage, timers, and debug UI.
- Performance is an engine feature, not a late cleanup task.
- Fixed timestep (60 Hz sim) — never use raw frame delta for gameplay.
- Spatial acceleration for collision and ray queries.
- Prefer data-oriented structures and typed arrays for hot paths.
- Object pools for frequently created objects (particles, projectiles).
- Profile before adding complex optimizations; keep profiling evidence.
- Prefer proven packages for hard subsystems (geometry, ray casting, audio).
- Avoid dependencies that only add convenience without reducing implementation risk.
- Keep pathfinding side-view-specific: platform graphs, patrol lanes, authored links.
- Add debug visibility when implementing physics, combat, or AI behavior.
- Prefer small, testable systems over broad rewrites.

## UI & Accessibility

- Menus, settings, pause screens, debug controls → separate engine UI module.
- Accessibility is exposed through the platform adapter; DOM is only a
  browser-preview implementation detail.
- Engine exposes state to UI through explicit APIs/events; UI never mutates simulation directly.

## Non-Goals

- Procedural world generation.
- Destruction physics / breakable terrain.
- Full rigid-body simulation (Box2D-style).
- 3D rendering of any kind.
- Networking / multiplayer (deferred indefinitely).
- Top-down, isometric, or hybrid perspectives.

## Platform Direction: Deno + SDL3 First

The intended runtime platform is **Deno + SDL3**. Browser preview is temporary
migration scaffolding, not a long-term renderer target. Browser APIs must not
define the engine architecture, and new renderer work should land on
`Renderer2D`, SDL textures, render targets, and platform-owned services.

To enable this:

- Keep all game logic (physics, entities, combat, input processing) as pure
  TypeScript with zero DOM/browser dependencies.
- Renderer is behind an interface; SDL3 is the first-class implementation.
  Canvas-shaped `RenderContext` and `Canvas2DPreview` paths must be removed
  during the SDL cutover.
- Input source is behind an abstraction; keyboard, gamepad, pointer, and touch
  events are normalized before systems see them.
- Audio is behind an interface; sample playback, spatial panning, and buses do
  not depend on Web Audio directly.
- Storage, timers, debug UI, and file access are behind explicit platform
  services.
- No `document`, `window`, DOM, Web Audio, `localStorage`, or
  `requestAnimationFrame` access in engine core. Browser-only demo code must
  stay isolated and move behind platform services or be deleted before SDL3
  becomes the default runtime.
