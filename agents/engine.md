# Engine

## Identity

`strange-path` is an open-source 2D side-view pixel-art engine built for
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

## Current Architecture

| Package | Role | State |
|---------|------|-------|
| `@strange-path/engine` | All engine systems | Thin today — only owns the rAF loop and canvas scaling. Will absorb all reusable systems. |
| `game` | Game demo | Will use engine APIs to prove the feel. Currently minimal. |

`engine-demo` is being deleted. All reusable systems move into `@strange-path/engine`;
game-specific demo code moves into `game`.

## Mandatory Systems

### Rendering

- Canvas-based.
- Layered pipeline: background → terrain → entities → lighting → particles/FX → UI/HUD → debug.
- Each layer implements `RenderLayer` interface with optional dirty tracking.
- Pixel-art scaling must stay crisp (nearest-neighbor).
- Offscreen canvases for light masks and cached terrain.
- No per-frame garbage in hot paths; batch and cache where measurable.
- Use libraries when they materially improve rendering, batching, or lighting.

### Entity System

- Lightweight entity pool with spawn/despawn/query-by-tag.
- Component composition: `PhysicsBody`, `Sprite`, `StateMachine`, `Hitbox`, `Hurtbox`.
- System interface: `update(entities, dt)`.
- No heavy ECS framework — tagged pool now, typed arrays for hot systems later.

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
- Offscreen canvas for masks and compositing.
- Debug: show ray hits, occluders, light bounds, visibility masks.

### Audio

- Sample playback (`.ogg`/`.mp3`) via `AudioBuffer`.
- Spatial panning based on entity-to-camera distance.
- Music layer with crossfade.
- Oscillator fallback for placeholder sounds.

### Debug & Diagnostics

- Frame rate, frame time graph, simulation time, render time, subsystem timings.
- Entity counts, draw counts, collision checks, ray counts.
- Toggle: collision boxes, hitboxes/hurtboxes, lighting debug, AI state labels.
- Controls: pause, step one frame, slow motion, restart state.
- Memory signals and engine-owned estimates (pool usage, resource cache sizes).
- Persist debug settings in localStorage.

## Implementation Rules

- Canvas owns game world rendering; native HTML elements own menus and debug UI.
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
- Canvas visual menus keep DOM-backed accessibility path for equivalent interaction.
- Engine exposes state to UI through explicit APIs/events; UI never mutates simulation directly.

## Non-Goals

- Procedural world generation.
- Destruction physics / breakable terrain.
- Full rigid-body simulation (Box2D-style).
- 3D rendering of any kind.
- Networking / multiplayer (deferred indefinitely).
- Top-down, isometric, or hybrid perspectives.

## Future Direction: Beyond the Browser

The browser is the stable development platform for now. The engine should
eventually run outside the browser as a native application via **Deno** (native
TypeScript execution, built-in WebGPU via wgpu, FFI for system libraries).

To enable this:

- Keep all game logic (physics, entities, combat, input processing) as pure
  TypeScript with zero DOM/browser dependencies.
- Renderer is behind an interface — `CanvasRenderingContext2D` today, swappable
  for a WebGPU pass via Deno later.
- Input source is behind an abstraction — browser keyboard/gamepad today, native
  event loop later.
- Audio is behind an interface — Web Audio API today, native audio backend later.
- No `document`, `window`, or DOM access in engine core. Platform bindings live
  in a thin adapter layer.

