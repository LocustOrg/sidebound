# Deno + SDL3 Migration — Final Steps

## Status

The SDL3 migration is structurally complete:

- Browser runtime deleted. No `platform-browser`, no `index.html`, no DOM code.
- `packages/engine/src` has zero browser or SDL3 imports.
- `packages/platform-sdl` is the sole production runtime.
- `deno task dev` runs the SDL3 debug room.
- `deno compile` tasks exist for macOS, Windows, and Linux.
- All cutover criteria from the original plan are met.

What remains is hardening: tests, CI, and one structural rename.

---

## Phase 1 — Fix CI

The current `.github/workflows/pr-checks.yml` references tasks that may not
exist or may be stale. Align it with the actual workspace.

Tasks:

1. Ensure root `deno.json` has a `check` task that runs `deno check` across
   engine, game, and platform-sdl packages.
2. Ensure root `deno.json` has a `lint` task.
3. Ensure root `deno.json` has a `test` task that runs `deno test` across the
   workspace.
4. Update `pr-checks.yml` to run:
   - `deno task check`
   - `deno task lint`
   - `deno task test`
5. Remove any reference to `deno task build` unless a real build task is added.

Done when:

- CI passes on a clean PR with no test files (no failures from missing tests).
- `deno task check` type-checks all three packages.

---

## Phase 2 — Engine Pure Tests

Add unit tests for engine systems that have no platform dependencies.

Location: `packages/engine/src/<module>/<name>_test.ts`

### 2.1 Geometry Helpers

File: `packages/engine/src/core/geometry_test.ts`

- `Rect` intersection, containment, expansion.
- `Vec2` arithmetic, normalization, distance.
- Edge cases: zero-size rects, negative coordinates.

### 2.2 Camera

File: `packages/engine/src/camera/side-view-camera_test.ts`

- Bounds clamping to world limits.
- Snapping behavior at edges.
- Follow target tracking.

### 2.3 Input Frame Reducer

File: `packages/engine/src/input/input-frame-reducer_test.ts`

- Key down/up transitions.
- Keys held across frames.
- Quit signal propagation.

### 2.4 Sprite Animation

File: `packages/engine/src/sprites/sprite-sheet_test.ts`

- Frame progression over time.
- Loop and one-shot modes.
- Correct source rect for frame index.

### 2.5 Content Validation

File: `packages/engine/src/content/registry_test.ts`

- Register and retrieve content by ID.
- Duplicate ID rejection.
- Missing ID errors.

### 2.6 World Validation

File: `packages/engine/src/world/tilemap_test.ts`

- Tile lookup by grid coordinate.
- Out-of-bounds handling.
- Collision flag queries.

### 2.7 Ray Lighting

File: `packages/engine/src/lighting/ray-lighting_test.ts`

- Cast count for a full sweep.
- Polygon sorting (clockwise).
- No casts when no light sources exist.

Done when:

- `deno test packages/engine/` passes with all tests green.
- Each test file is self-contained with no platform imports.

---

## Phase 3 — Renderer Contract Tests

Create a fake `Renderer2D` that records commands, then assert render layers
produce the correct output.

Location: `packages/engine/src/rendering/`

### 3.1 Fake Renderer

File: `packages/engine/src/rendering/fake-renderer.ts`

- Implements `Renderer2D`.
- Records every call as a command object in an array.
- Provides `getCommands()` and `reset()` helpers.

### 3.2 Pipeline Tests

File: `packages/engine/src/rendering/pipeline_test.ts`

- Running the pipeline with the fake renderer produces expected command
  sequences.
- Sprite draw emits correct source/destination rects.
- Debug layer emits `strokeRect` / `drawLine` commands.
- Lighting layer emits `fillRect` or render-target commands.

Done when:

- `deno test packages/engine/src/rendering/` passes.
- Fake renderer is reusable for future layer tests.

---

## Phase 4 — SDL3 Smoke Test

A minimal integration test that proves the SDL3 platform boots.

File: `packages/runtime/src/smoke_test.ts` (after rename; `packages/platform-sdl/src/smoke_test.ts` until then)

Requirements:

- Create a hidden window (or skip gracefully if display is unavailable in CI).
- Create the SDL renderer.
- Create one tiny texture from a generated pixel buffer.
- Present one frame.
- Destroy window and quit cleanly.

CI note: this test may need to be skipped in headless CI environments. Use a
`--ignore` pattern or Deno test filter when no display is available.

Done when:

- Test passes locally on macOS with SDL3 installed.
- CI gracefully skips or marks as ignored without failing the run.

---

## Phase 5 — Renames

### 5.1 Rename `packages/platform-sdl/` → `packages/runtime/`

SDL3 is the only runtime. The `platform-` prefix implies pluggable platforms
that will never exist. Just `runtime` is clearer.

Tasks:

1. Rename the directory.
2. Update `deno.json` workspace references and import map entries.
3. Update all import paths in game and engine packages.
4. Update CI workflow if it references `platform-sdl` by name.
5. Run `deno task check` to confirm no broken imports.

### 5.2 Rename `packages/engine/src/platform/` → `packages/engine/src/runtime/`

The engine's interface directory holds abstract contracts (clock, input-source,
renderer, storage, loop). Rename to `runtime/` — these are the runtime contract
types that `packages/runtime/` implements.

Tasks:

1. Rename the directory.
2. Update all internal engine import paths.
3. Update `packages/engine/src/mod.ts` barrel export.
4. Run `deno task check`.

Done when:

- No `platform-sdl` or `engine/src/platform` directories exist.
- `packages/runtime/` is the SDL3 implementation.
- `packages/engine/src/runtime/` holds the abstract type contracts.
- All packages type-check cleanly.

---

## Phase 6 — Final Cleanup

1. Archive or delete this migration plan file — the migration is complete.
2. Update `agents/roadmap.md` to reflect SDL3 as the only runtime with no
   migration context.
3. Ensure `README.md` documents:
   - `brew install sdl3 sdl3_image` prerequisite.
   - `deno task dev` to run.
   - `deno task compile:mac` to build.
   - `deno test` to run tests.

Done when:

- No migration-era documentation references browser rendering as current.
- A new contributor can clone, install SDL3, and run the game from README alone.

---

## Design Note: Why Keep the Abstraction?

SDL3 is the only runtime and always will be. The engine's `runtime/` types
exist for two practical reasons only:

1. **Tests without native libs.** A recording fake `Renderer2D` lets you test
   render pipeline output without a window, GPU, or SDL3 installed.
2. **CI without SDL3.** `deno check packages/engine/` works anywhere. Without
   the type boundary, CI would need SDL3 native libraries just to type-check
   game logic.

This is not a multi-platform abstraction. It is a compile boundary.

