# Debug And Performance

The demo should include a bulky debug system. It should help find problems in
the engine itself: frame pacing, memory growth, collision behavior, combat
timing, AI state, rendering cost, ray-based lighting cost, and resource usage.

## Required Debug Views

- Frame rate.
- Frame time graph.
- Simulation time.
- Render time.
- Subsystem timings.
- Entity counts.
- Draw counts.
- Collision checks.
- Ray counts and ray hit counts.
- Active lights and occluders.
- Loaded resources and texture/sprite counts.
- Memory information where the platform exposes it.
- Engine-owned memory estimates such as pool usage, allocation counters, and
  resource cache sizes.

## Required Debug Controls

- Toggle collision boxes.
- Toggle hitboxes and hurtboxes.
- Toggle lighting rays, occluders, and visibility masks.
- Toggle AI state labels.
- Pause simulation.
- Step one frame.
- Slow motion.
- Restart demo state.
- Toggle subsystem timing panels.
- Persist every user-controlled debug window setting in local storage during
  development.

## Performance Rules

- Treat performance as an engine feature, not a late cleanup task.
- Avoid per-frame garbage in hot loops.
- Use object pools for frequently created gameplay/debug objects when needed.
- Prefer data-oriented structures for entities, collision, particles, and rays
  when it improves measurable performance.
- Use typed arrays where they make hot-path data cheaper and clearer.
- Use spatial acceleration structures for collision and ray queries.
- Cache static geometry and recompute dynamic data only when dirty.
- Profile before adding complex optimizations, then keep the profiling evidence
  close to the decision.

## Ray-Based Lighting Performance

Use strong techniques for ray tracing, ray casting, or equivalent visibility:

- Spatial partitioning such as grids, quadtrees, or BVH-like structures.
- Cached static occluder segments.
- Dirty flags for moved lights or occluders.
- Lower-resolution light buffers composited into the main scene.
- Precomputed static light or shadow data where the map allows it.
- Offscreen buffers for masks and compositing.
- `OffscreenCanvas` or workers if measurements show the main thread needs help.
- Ray budgets and quality tiers for debug comparisons.

Lighting should make the game feel strange and dangerous, but it must remain
debuggable and performant enough for combat readability.
