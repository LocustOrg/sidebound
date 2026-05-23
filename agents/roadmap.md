# Roadmap: Risk of Rain–Style Engine

## Goal

Build an open-source 2D side-view engine inspired by **Risk of Rain (Returns)** rendering and capabilities. The primary differentiator is **interaction physics** (entities pushing, pulling, hooking, stacking, riding, bouncing off each other) rather than destruction physics. The engine should be easy to adopt, performant, and provide a clear rendering pipeline.

---

## Current State Assessment

### What exists today

| System | Status | Notes |
|--------|--------|-------|
| Core loop | ✅ Working | `PixelEngine` with update/render split |
| Player movement | ✅ Working | Gravity, jump, friction, state machine |
| Collision | ⚠️ Basic | AABB sweep against static rects only |
| Camera | ✅ Good | Smooth damp, dead-zone, look-ahead, recoil |
| Lighting | ⚠️ Expensive | Ray-cast per frame, no spatial index, runs in render pass |
| Sprite system | ✅ Working | Procedural sheet, animator, clips |
| Rendering | ⚠️ Monolithic | Single class mixes scene, lighting, debug, mob drawing |
| Input | ✅ Basic | Keyboard only, no buffering |
| Audio | ✅ Placeholder | Oscillator tones |
| Debug panel | ✅ Good | Metrics, toggles |
| Engine package | ⚠️ Thin | Only owns the canvas loop |
| World/map | ✅ Basic | Static text sketch → merged rects |

### Critical issues and inconsistencies

1. **Rendering pipeline is not layered.** `DemoRenderer` draws background, solids, lighting, mobs, and debug in one flat class with no concept of layers, draw order, or batching. Every frame re-draws the entire world regardless of camera movement.

2. **Lighting runs inside `render()`.** Ray-casting is a simulation concern that mutates light polygons. Putting it in the render callback means the cost is tied to frame rate, not tick rate, and cannot be cached across identical frames.

3. **No fixed timestep.** `update()` uses variable delta clamped to 50 ms. This causes non-determinism and makes future replay/netcode impossible. Risk of Rain Returns uses a fixed 60 Hz tick.

4. **No spatial partitioning.** Collision and lighting iterate all solids every frame. Fine for the demo map, but O(n²) for real levels.

5. **Engine package is too thin.** All interesting logic lives in `engine-demo`. Nothing is reusable. Types like `Vec2`, `Rect`, `Animator`, `SpriteSheet`, collision helpers should be engine-owned.

6. **No entity system.** Only one `PlayerMob` exists. No entity list, no generic update loop, no spawn/despawn lifecycle.

7. **No interaction physics.** Entities cannot push, stack on, ride, bounce off, or hook to each other. This is the stated primary goal.

8. **No tilemap renderer.** World is drawn as raw fillRects with magic colors. Risk of Rain style uses tiled terrain with auto-tiling and parallax backgrounds.

9. **No parallax / background layers.** RoR Returns uses 3–5 parallax planes for depth.

10. **Player sprite is fully procedural at 605 lines.** Impressive, but hard to iterate on for non-programmers and expensive to generate at startup. Should be a build-time asset or a loaded sprite sheet.

11. **`createBitmapSheet` uses `fillRect` per pixel.** Should use `ImageData` + `putImageData` for bulk writes.

12. **No gamepad / touch support.** RoR supports controllers natively.

13. **No screen shake.** Listed in engine-capabilities but not implemented.

14. **No hitbox/hurtbox system.** Combat is listed as mandatory but has zero implementation.

15. **Audio is oscillator-only.** No sample playback, no spatial panning.

---

## Architecture Plan

### Phase 0 — Rendering Pipeline Simplification (immediate)

**Problem:** The renderer is a monolithic class that re-draws everything every frame with no concept of layers or caching.

**Solution — Layered Render Pipeline:**

```
RenderPipeline
├── Layer 0: ParallaxBackground (multiple planes, scroll factor)
├── Layer 1: TileMap (terrain, only dirty tiles redrawn)
├── Layer 2: Entities (sorted by y or explicit z-order)
├── Layer 3: Lighting (composited via offscreen canvas)
├── Layer 4: Particles / FX
├── Layer 5: UI / HUD (fixed to camera)
└── Layer 6: Debug Overlay
```

Each layer implements:
```ts
interface RenderLayer {
  order: number
  update(dt: number): void           // optional per-layer sim (particles)
  render(ctx: CanvasRenderingContext2D, camera: Rect): void
  dirty?: boolean                    // skip redraw when nothing changed
}
```

**Key changes:**
- Move lighting ray-cast into `update()` and cache the polygon.
- Introduce an offscreen canvas for the light mask; composite once.
- Background layers only redraw on camera move.
- Tile layer uses a tile buffer canvas, redraws only scrolled-in tiles.
- Entities batch their draws; no per-entity `save()/restore()`.

### Phase 1 — Engine Core Extraction

Move reusable primitives from `engine-demo` into `@strange-path/engine`:

- `Vec2`, `Rect`, `Segment`, math helpers
- `SpriteSheet`, `Animator`, `AnimationClip`
- `RenderPipeline` and `RenderLayer` interface
- `FixedTimestep` (decouple sim rate from frame rate)
- `InputManager` (keyboard + gamepad + touch abstraction)
- `CollisionWorld` (spatial hash or grid, AABB queries)
- `Camera` (generic side-view camera with shake)
- `EntityPool` (spawn, despawn, iterate, query by tag/component)

### Phase 2 — Interaction Physics

This is the **primary goal** — entities that physically interact:

| Feature | Description |
|---------|-------------|
| Push/block | Entities push each other horizontally when overlapping |
| Ride/carry | Entity standing on another moves with it |
| Bounce | Configurable restitution on entity-entity collision |
| Hook/tether | Attach point-to-point constraints between entities |
| Conveyor/wind | Area forces that affect all overlapping entities |
| Knockback | Directional impulse applied on hit |
| Weight/mass | Heavier entities are harder to push |
| One-way platforms | Entities can stand on each other from above only |

**Implementation approach:**
- Each entity has a `Body` component: position, velocity, mass, friction, bounciness, `isKinematic`, `isPlatform`.
- `PhysicsWorld.step(dt)` resolves entity-entity overlaps using separation + impulse.
- Collision layers: `PLAYER`, `ENEMY`, `PROJECTILE`, `PLATFORM`, `TRIGGER`.
- Collision response is configurable per layer pair (push, bounce, ignore, trigger-only).

### Phase 3 — Tilemap & Auto-Tiling

Risk of Rain Returns uses authored tile maps with rule-based auto-tiling for edges, corners, and overhangs.

- Implement a `TileMap` class backed by a 2D `Uint8Array` (layer per terrain type).
- Auto-tile rules select the correct sub-tile from a tileset atlas.
- Render to an offscreen buffer; only re-render dirty chunks.
- Collision geometry generated from the tile grid (merged rects, same approach as today but engine-owned).
- Support one-way (drop-through) platform tiles.

### Phase 4 — Combat Framework

- Hitbox/hurtbox rectangles attached to animation frames.
- Attack phases: `windup → active → recovery`.
- Hitstop (freeze both attacker and target for N frames on contact).
- Invincibility frames (i-frames) on dodge/hit.
- Stagger accumulation and stagger-break.
- Knockback as interaction-physics impulse.

### Phase 5 — Enemy AI & Spawning

- Finite state machine: `idle → patrol → notice → chase → attack → recover → stagger → dead`.
- Patrol between authored waypoints on a platform.
- Chase with simple edge-detection (don't walk off ledges).
- Attack range and cooldown.
- Spawn/despawn tied to camera proximity or room triggers.

### Phase 6 — World Structure

- Room/chunk system with transitions.
- Parallax backgrounds per room.
- Persistent world flags (boss killed, door opened).
- Checkpoints / respawn points.
- Trigger volumes (boss arena lock, item pickup, NPC dialogue).

---

## Tasks (Priority Order)

### T1 — Fixed Timestep ⬅️ DO FIRST
- Add `FixedTimestep` class to engine: accumulates real time, calls `update()` at fixed 60 Hz, interpolates render.
- Decouple `update()` and `render()` rates.
- Why first: every other system depends on deterministic simulation.

### T2 — Layered Render Pipeline
- Create `RenderLayer` interface.
- Create `RenderPipeline` that owns an ordered list of layers.
- Refactor `DemoRenderer` into: `BackgroundLayer`, `TerrainLayer`, `EntityLayer`, `LightingLayer`, `DebugLayer`.
- Move ray-cast into `update()`; `LightingLayer.render()` only composites the cached polygon.

### T3 — Offscreen Light Buffer
- Allocate an offscreen canvas at viewport size.
- Draw the darkness + light-polygon cutout to the offscreen canvas.
- Composite onto the main canvas with a single `drawImage`.
- Eliminates multiple composite-mode switches per frame.

### T4 — Spatial Hash for Collision & Lighting
- Implement a 2D grid spatial hash (`CellSize` = 64 or 128 px).
- Insert all static solids at init; query only cells near the entity/light.
- Reduces ray-cast checks from O(segments) to O(nearby segments).

### T5 — Engine Core Extraction
- Move `Vec2`, `Rect`, `Segment`, math to `@strange-path/engine`.
- Move `SpriteSheet`, `Animator` to engine.
- Move `Camera` to engine.
- Move `InputManager` to engine (add gamepad).
- Export a `createEngine()` factory that wires pipeline + loop + input.

### T6 — Entity System
- `Entity` base: id, position, velocity, tags, components.
- `World` manages entity lifecycle: `spawn()`, `despawn()`, `query()`.
- `System` interface: `update(entities, dt)`.
- Mob becomes an entity with `PhysicsBody`, `Sprite`, `StateMachine` components.

### T7 — Interaction Physics
- `PhysicsBody` component: mass, restitution, friction, layers.
- `PhysicsWorld.step(dt)`: broad-phase (spatial hash) → narrow-phase (AABB) → response.
- Response types per layer-pair: `push`, `bounce`, `ride`, `trigger`, `ignore`.
- Test: two entities pushing each other, one riding another.

### T8 — Tilemap Renderer
- `TileMap` class with `Uint8Array` storage.
- Auto-tile rule evaluator (4-bit or 8-bit neighbor mask).
- Chunked offscreen rendering (e.g. 16×16 tile chunks).
- Collision rect generation from tile data.

### T9 — Parallax Backgrounds
- `ParallaxLayer`: image, scroll factor X/Y, repeat mode.
- Render before terrain layer.
- Support multiple planes (sky, far mountains, near trees, fog).

### T10 — Combat Hitbox System
- `HitboxComponent`: rect relative to entity, active frames, damage, knockback.
- `HurtboxComponent`: rect relative to entity, i-frame timer.
- `CombatSystem` checks hitbox-hurtbox overlap each tick.
- On hit: apply damage, knockback impulse, hitstop, i-frames.

### T11 — Screen Shake & Juice
- Camera shake: amplitude, frequency, decay.
- Hitstop: freeze simulation for N frames.
- Flash entity white on damage.
- Particle burst on hit.

### T12 — Gamepad Support
- Map gamepad axes/buttons to the same `PlayerInputFrame`.
- Dead-zone handling.
- Vibration on hit (if supported).

### T13 — Audio Upgrade
- Load `.ogg`/`.mp3` samples via `AudioBuffer`.
- Spatial panning based on entity-to-camera distance.
- Music layer with crossfade on room transition.

---

## Step-by-Step Problem Solving

### Problem 1: Rendering is too slow and monolithic

**Steps:**
1. Profile current frame time breakdown (already have `renderMs`, `rayMs`).
2. Identify the biggest cost (likely lighting ray-cast + gradient creation every frame).
3. Cache the light polygon between frames when origin hasn't moved.
4. Move gradient creation out of the hot path (create once, reuse).
5. Introduce offscreen canvas for light mask.
6. Split renderer into layers, each with independent dirty tracking.
7. Background/terrain layers only re-render on camera scroll delta > 0.

### Problem 2: No fixed timestep causes physics jitter

**Steps:**
1. Implement an accumulator-based fixed timestep (60 Hz).
2. `update()` runs 0–N times per frame at fixed dt.
3. `render()` interpolates entity positions between last and current state for smooth visuals.
4. Cap accumulator to prevent spiral of death (max 4 updates per frame).
5. Ensure all gameplay code uses the fixed dt, never raw frame delta.

### Problem 3: No entity-entity interaction

**Steps:**
1. Define `PhysicsBody` interface (position, velocity, mass, bbox, layers, response type).
2. Implement broad-phase: spatial hash query for overlapping entity pairs.
3. Implement narrow-phase: AABB overlap test with penetration depth + normal.
4. Implement response: separate entities by penetration, apply impulse based on mass ratio.
5. Special-case "ride" response: if entity B is standing on entity A, B inherits A's velocity.
6. Special-case "bounce": apply restitution coefficient to relative velocity along normal.
7. Test with player + moving platform, player + pushable crate, two enemies colliding.

### Problem 4: Engine is not reusable

**Steps:**
1. Identify all code in `engine-demo` that is generic (math, sprite, camera, input).
2. Move to `@strange-path/engine` with proper exports.
3. Keep demo-specific code (player-sprites, demo-map, debug-panel) in demo.
4. Ensure engine has zero demo dependencies.
5. Write a minimal "getting started" example that uses only engine exports.

### Problem 5: Lighting is O(n) per ray, O(rays × segments) total

**Steps:**
1. Implement spatial hash for segments (bucket by grid cell they pass through).
2. On cast, only test segments in cells the ray passes through.
3. Cache corner-angle set when occluder geometry hasn't changed (static map).
4. Reduce `radialRaySamples` from 128 to ~64 + endpoint rays (corners already add precision).
5. Consider resolution-scaled light buffer (render at half resolution, upscale).

### Problem 6: Sprite pipeline is programmer-only

**Steps:**
1. Support loading external `.png` sprite sheets via `Image` + async load.
2. Keep procedural generation as a fallback/dev tool.
3. Define a JSON manifest format: `{ image, frameWidth, frameHeight, clips: [...] }`.
4. Build a tiny sprite-sheet preview tool (canvas that plays clips on click).

---

## Risk of Rain Returns — Reference Capabilities

For parity with RoR Returns rendering style, we need:

- [x] Pixel-art upscaling (nearest-neighbor)
- [ ] Parallax scrolling backgrounds (3–5 layers)
- [ ] Tile-based terrain with auto-tiling
- [ ] Large entity counts (20+ enemies on screen)
- [ ] Particle systems (hit sparks, dust, explosions)
- [ ] Screen shake on big hits
- [ ] Weather / ambient effects (rain, fog, ash)
- [x] Dynamic lighting (point lights)
- [ ] Entity stacking / riding (interaction physics)
- [ ] Knockback / launch physics
- [ ] Proc-gen item stacking (visual + mechanical)
- [ ] HUD overlay (health bars, item display)
- [ ] Minimap

---

## Non-Goals (Explicitly Out of Scope)

- Destruction physics (terrain deformation, breakable walls)
- Full rigid-body simulation (Box2D-style)
- 3D rendering of any kind
- Procedural world generation
- Networking / multiplayer (deferred)
- React-based UI

