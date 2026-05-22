# Engine Capabilities

The engine should first prove the fundamentals of a pixel-art soulslike:
movement, collision, combat timing, enemy behavior, boss patterns, map triggers,
ray-based lighting, and debug visibility.

## Mandatory Core Systems

### Rendering Architecture

- The game renderer is canvas-based.
- Do not build the game view with React.
- Keep rendering, simulation, input, UI, and diagnostics as separate engine
  concerns.
- Pixel-art scaling must stay crisp and predictable.
- Rendering should be built for high performance from the beginning: avoid
  per-frame garbage, unnecessary allocations, and avoidable redraw work.
- Use rendering libraries when they materially improve performance, batching,
  asset handling, or ray-based lighting work.

### Accessible UI And Menus

- Menus, settings, pause screens, debug controls, and similar interaction-heavy
  surfaces should live in a separate engine UI module.
- Prefer native HTML elements for controls that need keyboard navigation, focus,
  form behavior, or assistive technology support.
- The UI module must not require React.
- If a menu is visually represented in canvas, keep a DOM-backed accessibility
  path for equivalent interaction.

### Player Controller

- Directional 2D movement.
- Dodge, roll, or dash with invincibility frames.
- Stamina cost and stamina recovery.
- Attack commitment with windup, active frames, and recovery.
- Temporary movement limits during attacks.
- Stagger, knockback, death, and respawn states.

### Combat Engine

- Hitboxes and hurtboxes as first-class debug-visible objects.
- Attack timing split into windup, active, and recovery phases.
- Damage application only during active frames.
- Hitstop or impact pause for readable contact.
- Player invincibility windows.
- Enemy invulnerability or stagger thresholds where needed.
- Clear separation between visual animation and gameplay timing data.

### Collision And Physics

- Fixed timestep simulation.
- Tile or object collision.
- Collision layers for player, enemies, walls, triggers, projectiles, and
  interactables.
- Reliable dash and lunge collision, avoiding tunneling through walls or targets.
- Knockback and pushback.
- No full rigid-body simulation unless a specific mechanic requires it.

### Ray-Based Lighting And Visibility

- Ray tracing, ray casting, or equivalent visibility sampling is important for
  the game's atmosphere and should be treated as a core feel system.
- Support light sources that can be blocked by walls, doors, terrain, or large
  objects.
- Support darkness, shadow, and reveal behavior without making combat
  unreadable.
- Keep lighting debug-visible: show ray hits, occluders, light bounds, and
  visibility masks when debug mode is enabled.
- Prefer a proven rendering, visibility, or geometry library if it makes this
  reliable faster than custom math.
- Use performance techniques such as spatial partitioning, cached occluder
  geometry, light masks, resolution-scaled lighting buffers, dirty regions, and
  static precomputation where they fit the implementation.

### Enemy AI

- State-machine-driven behavior.
- Required states: idle, patrol, notice, chase, attack, recover, stagger, dead.
- Attack range checks.
- Cooldowns and telegraph timing.
- Local obstacle avoidance or pathfinding appropriate to the final perspective.

### Boss Framework

- Boss arena triggers.
- Arena lock and unlock events.
- Phase changes by health threshold or scripted state.
- Pattern selection with cooldowns.
- Telegraphs before dangerous attacks.
- Boss death event that can unlock doors, flags, routes, or rewards.

### Map And World State

- Tilemap, room, or chunk-based map representation.
- Area transitions.
- Triggers for doors, fog gates, NPC proximity, boss arenas, and item pickups.
- Persistent world flags such as boss defeated, shortcut opened, item acquired.
- Checkpoints or rest points.
- Respawn rules for player and enemies.

### Camera

- Pixel-perfect rendering.
- Smooth follow with a small deadzone.
- Boss arena framing.
- Screen shake or hit shake.
- Avoid camera behavior that makes enemy attacks unreadable.

### Debug And Diagnostics

- The demo should have a bulky debug system, not just a small overlay.
- Show frame rate, frame time, simulation time, render time, and subsystem timing.
- Show memory information where the platform exposes it, plus engine-owned
  estimates such as entity counts, resource counts, pool usage, and allocation
  counters.
- Toggle collision boxes.
- Toggle hitboxes and hurtboxes.
- Show active player state.
- Show stamina, invincibility frames, and attack phase.
- Show enemy AI state.
- Show boss phase and selected pattern.
- Show lighting rays, occluders, and visibility masks.
- Show draw counts, ray counts, collision checks, active entities, and loaded
  resources.
- Support pause, single-step frame advance, slow motion, and deterministic
  replay hooks where practical.
- Debug tools should help find memory, performance, simulation, combat, and
  rendering problems.

## Outside Engine Scope

- Procedural world generation.

The world may be large, interconnected, and surprising, but generation is not an
engine requirement. Build tools and data structures that support authored maps
instead.

## Deferred Systems

Do not implement these until the core demo proves the combat and movement feel:

- Full inventory.
- Full quest system.
- Full dialogue system.
- Crafting.
- Complex status-effect matrix.
- Final production lighting polish.
- Destructible terrain.
- Networking or multiplayer.
- Huge world streaming.
