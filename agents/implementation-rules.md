# Implementation Rules

These rules apply to agents working in this repository.

## Repo Constraints

- Keep engine work inside `packages/engine` unless game integration requires
  `packages/game`.
- Keep game demo work inside `packages/game` unless shared engine code is needed.
- Prefer small, testable systems over broad rewrites.
- Add debug visibility when implementing physics, combat, or AI behavior.
- Build the game renderer around canvas, not React.
- Treat side-view action-platformer movement as the only engine perspective.
- Do not add top-down, three-quarter, isometric, or hybrid movement systems.
- Keep pathfinding side-view-specific: platform graphs, patrol lanes, and
  authored traversal links before any broader search system.
- Use libraries and packages when they simplify real engine work.
- Prefer proven packages for hard subsystems such as rendering, ray casting,
  geometry, pathfinding, asset loading, animation, or audio instead of
  hand-rolling them too early.
- Avoid dependencies that only add convenience without reducing meaningful
  implementation risk.

## UI Constraint

- Do not use React for this project.
- The game view should render through canvas.
- Menus, settings, pause screens, debug controls, and accessibility-heavy
  interactions should be handled by a separate non-React UI module.
- Prefer native HTML controls for keyboard accessibility and focus behavior.

## Performance Constraint

- The engine should be as performant as practical from the beginning.
- Avoid per-frame allocations in hot loops.
- Prefer data-oriented structures, typed arrays, object pools, batching, and
  spatial indexes where they reduce measurable cost.
- Profile before adding complicated optimizations, but keep systems shaped so
  optimization remains possible.
- Ray-based lighting should use serious acceleration techniques when needed,
  including spatial partitioning, cached static geometry, dirty flags,
  lower-resolution light buffers, workers or `OffscreenCanvas` if useful, and
  precomputed static light data where appropriate.

## Design Constraints

- Do not build a marketing landing page for the game demo.
- The first screen should be the playable demo or tool surface.
- Keep pixel-art readability in mind when adding camera effects or scaling.
- Do not hide gameplay rules inside visual-only animation code.

## Engineering Priorities

1. Make the simulation deterministic enough to debug.
2. Make combat timing explicit in data or state.
3. Make collision and hit detection visible in debug mode.
4. Make ray-based lighting and visibility debuggable.
5. Make frame rate, memory, subsystem timing, and engine resource usage visible.
6. Make behavior easy to tune without rewriting systems.
7. Keep early systems narrow around the side-view engine direction.
