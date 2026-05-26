# Deno + SDL3 Migration Plan

## Intent

Move `sidebound` from a browser-preview-first runtime to a Deno executable
runtime backed by SDL3. Browser preview may remain only as temporary comparison
scaffolding, and it must not define engine architecture.

## End Goal

SDL3 is the base layer of the engine. The final project should not maintain
browser, desktop, Deno, and SDL as parallel runtime platforms.

The engine may keep small engine-owned seams such as `Renderer2D`, input frames,
texture handles, clocks, storage, and asset payloads, but those are internal
engine contracts and test seams, not a promise of multiple production platforms.
Only the SDL3 runtime package imports `@sdl3/sdl3-deno`; gameplay and reusable
engine systems use engine-owned types.

The browser renderer should be deleted after SDL3 debug-room parity and package
smoke coverage. If a browser preview is ever useful later, it must be rebuilt as
a separate experimental tool outside this engine workspace.

This plan is intentionally precise. Follow it in order. Do not skip a phase just
because the browser harness still works.

## Source Facts

- `deno compile` embeds the module graph into an executable. Runtime permissions
  must be passed at compile time. Use `--include` for files/directories and
  workers that are not statically included.
- `deno compile` supports cross-compilation targets for Windows, macOS, and
  Linux, but native dynamic libraries still need platform-specific packaging.
- Deno FFI requires explicit permissions (`--allow-ffi` or `-A`) and loads native
  dynamic libraries.
- Use current Deno CLI flags in new code. The older Flappy Bird blog example uses
  `--unstable-ffi`, but the current Deno FFI docs show `--allow-ffi` as the
  required permission.
- Use `@sdl3/sdl3-deno` for the SDL runtime, with all direct imports isolated
  to `packages/platform-sdl`.
- The older Deno Flappy Bird example remains useful only as a packaging shape:
  Deno + native graphics binding + `deno compile` + native libraries beside the
  executable.

Reference links:

- Deno compile docs: https://docs.deno.com/runtime/reference/cli/compile/
- Deno FFI docs: https://docs.deno.com/runtime/fundamentals/ffi/
- `@sdl3/sdl3-deno` package: https://jsr.io/@sdl3/sdl3-deno
- Deno compile blog / Flappy Bird example: https://deno.com/blog/deno-compile-executable-programs
- Example repo: https://github.com/littledivy/flappybird

## Non-Negotiables

- `packages/engine` must not import `@sdl3/sdl3-deno`, `Deno`, `document`,
  `window`, `HTMLCanvasElement`, `CanvasRenderingContext2D`, Web Audio,
  `localStorage`, or browser-preview tooling APIs.
- `packages/game` must become a Deno debug harness. It may define demo content,
  debug scenes, and platform choice, but it must not own reusable engine systems.
- SDL3-specific code belongs in `packages/platform-sdl`.
- Browser-specific code may exist only during migration, isolated in
  `packages/platform-browser` or an explicitly named browser-preview submodule.
  It must be deleted before the migration is done.
- Rendering migration must use explicit renderer commands or renderer interfaces.
  Do not keep pretending an SDL3 canvas is a DOM-like canvas 2D context.
- Each phase must keep either the browser harness or the SDL3 harness runnable.
  Prefer a temporary dual-runtime period over a giant cutover.
- Do not add new browser renderer features. Browser code may be touched only to
  preserve temporary preview behavior while SDL3 catches up.

## Active Work

- Remove `Canvas2DPreviewPlatform`, `RenderContext`, and browser-shaped image
  handles from engine-owned sprite, character, diagnostics, asset, and lighting
  code.
- Implement SDL3 texture loading/drawing and render targets.
- Convert game render layers and lighting effects from Canvas2D calls to
  `Renderer2D` commands or platform-specific textures.
- Boot `packages/game` through SDL3 instead of the browser preview.
- Add `deno compile` tasks and native-library packaging.

## Reachable Cutover Plan

1. **Freeze browser renderer scope.** No new browser rendering, DOM debug, Web
   Audio, or Canvas2D lighting work unless it is required to keep comparison
   parity during migration.
2. **Create the renderer seam.** Remove engine-owned `RenderContext` and
   `Canvas2DPreview*` dependencies from sprites, character rendering,
   diagnostics, assets, and lighting.
3. **Make SDL3 draw real assets.** Implement image loading, texture handles,
   `drawTexture`, render targets, and the small set of blend modes needed for
   sprites and debug overlays.
4. **Port layers one at a time.** Convert terrain first, then entities/items,
   then debug overlays, then lighting. Each converted layer must render through
   `Renderer2D`.
5. **Boot the debug room in SDL3.** Start without minimap, DOM debug panel, audio,
   and full light compositing; keep movement, camera, collision, sprites, item
   pickups, and collision debug working.
6. **Make SDL3 default.** Switch `dev` to SDL3, move browser to `dev:browser`, and
   add compile/package tasks.
7. **Delete the browser renderer.** Remove browser renderer code once SDL3
   parity and package smoke coverage are stable. Keep only test doubles and
   SDL3 as the real runtime layer.

## Desired Final File Structure

```txt
packages/
  engine/
    src/
      assets/
      camera/
      content/
      core/
      diagnostics/
      input/
      lighting/
      runtime/
        assets.ts
        clock.ts
        input.ts
        loop.ts
        renderer.ts
        storage.ts
      rendering/
        commands.ts
        pipeline.ts
        layers/
          debug.ts
          lighting.ts
          sprites.ts
      sprites/
      world/

  platform-sdl/
    deno.json
    src/
      mod.ts
      app.ts
      assets.ts
      audio.ts
      clock.ts
      input.ts
      runtime.ts
      renderer.ts
      sdl-types.ts
      storage.ts
      window.ts

  game/
    deno.json
    assets/
      sprites/
      audio/
    src/
      main.ts
      game.ts
      content/
      world/
      scenes/
      entities/
      systems/
```

No `packages/platform-browser` remains in the final layout. No engine source
file imports DOM, Canvas2D, browser storage, Web Audio, or requestAnimationFrame.

## Target Runtime APIs

Engine code should see these interfaces, not SDL3 or DOM classes. These
interfaces are for engine cleanliness and tests; SDL3 is still the only
production runtime target.

```ts
export type EngineClock = {
    now(): number
    sleep?(ms: number): Promise<void>
}

export type EngineWindowConfig = {
    title: string
    logicalSize: readonly [width: number, height: number]
    pixelScale: 'integer-fit' | number
    resizable?: boolean
}

export type EngineRuntime = {
    readonly clock: EngineClock
    readonly input: InputSource
    readonly renderer: Renderer2D
    readonly assets: AssetLoader
    readonly storage: KeyValueStorage
    run(loop: EngineRuntimeLoop): Promise<void>
    dispose(): void | Promise<void>
}

export type EngineRuntimeLoop = {
    update(deltaSeconds: number, input: InputEvents): void
    render(frame: RenderFrame): void
}
```

Renderer API:

```ts
export type RenderFrame = {
    readonly renderer: Renderer2D
    readonly camera: Rect
}

export type TextureHandle = {
    readonly id: string
    readonly width: number
    readonly height: number
}

export type RenderTargetHandle = {
    readonly id: string
    readonly width: number
    readonly height: number
}

export type Renderer2D = {
    beginFrame(clearColor: ColorRgba): void
    endFrame(): void

    createRenderTarget(id: string, width: number, height: number): RenderTargetHandle
    setRenderTarget(target: RenderTargetHandle | null): void

    loadTexture(id: string, source: ImageSource): Promise<TextureHandle>
    drawTexture(texture: TextureHandle, source: Rect, dest: Rect, options?: DrawOptions): void

    fillRect(rect: Rect, color: ColorRgba): void
    strokeRect(rect: Rect, color: ColorRgba): void
    drawLine(from: Vec2, to: Vec2, color: ColorRgba): void
    drawPolygon(points: readonly Vec2[], color: ColorRgba): void
}

export type DrawOptions = {
    flipX?: boolean
    alpha?: number
    tint?: ColorRgba
}
```

Input API:

```ts
export type InputSource = {
    poll(): InputEvents
}

export type InputEvents = {
    readonly quitRequested: boolean
    readonly keysDown: readonly string[]
    readonly keysUp: readonly string[]
    readonly keysHeld: ReadonlySet<string>
    readonly pointerDown: readonly PointerEventFrame[]
    readonly pointerUp: readonly PointerEventFrame[]
}
```

## Phase 1 - Runtime Boundary Cleanup

Goal: finish making engine runtime interfaces honest.

- Replace `RenderContext` in engine-owned sprites, character rendering,
  diagnostics, asset loading, and lighting with `Renderer2D`/texture-oriented
  interfaces.
- Move or delete `Canvas2DPreviewPlatform`, `Canvas2DPreviewSurface`, and
  `Canvas2DPreviewRenderFrame` from engine public APIs once their users are
  converted.
- Keep the browser preview adapter compiling while this happens, but do not
  improve or expand its renderer.

Done when:

- Engine-owned runtime code no longer exposes `Canvas2DPreview*` or
  `RenderContext` as the normal sprite/lighting/diagnostics path.
- `packages/game` still runs through the browser preview adapter.
- `deno task check && deno task build` passes through the mise-managed Deno toolchain.

## Phase 2 - SDL3 Renderer And Packaging Work

1. Implement asset-backed image loading for SDL3.
2. Implement texture creation/copy and `Renderer2D.drawTexture`.
3. Implement render targets or an explicit fallback path for cached terrain,
   debug overlays, and light masks.
4. Implement only the blend/composite behavior required by the next SDL3
   milestone.
5. Add SDL3 package checks to root `check` once native binding availability is
   reliable in CI.

## Phase 3 - SDL3 Event Loop And Input

Goal: SDL3 owns runtime events; engine receives typed input frames.

- Replace or extend `InputManager` so browser preview and SDL3 can both feed the
  same action-frame reducer.
- Wire SDL3 input into the game player controller.
- Keep browser preview input working during the dual-runtime period.

Done when:

- SDL3 and browser preview share the same action-frame reducer.
- Keyboard left/right/jump input affects the player.
- Browser preview input still works.

## Phase 4 - Texture And Asset Loading

Goal: load game images as SDL3 textures through the asset layer.

1. Replace `ImageSource` with an engine-owned asset payload:

```ts
export type ImageAssetSource = { kind: 'file'; path: string } | { kind: 'bytes'; bytes: Uint8Array; mimeType: string }
```

2. Update content asset definitions to use stable asset ids and relative paths:

```ts
{ id: 'characters/player/base', path: 'assets/sprites/player-base.png' }
```

3. For development, keep using `SdlAssetLoader.loadBytes()` and
   `resolvePath()` to read files from `packages/game/assets/...`.
4. For compiled executables, support both:
    - `deno compile --include packages/game/assets`.
    - generated asset modules if SDL3 image loading requires real byte buffers.
5. Implement `SdlRenderer.loadTexture(id, source)`:
    - If `source.kind === 'file'`, prefer `Surface.fromFile(path)` if supported.
    - If `source.kind === 'bytes'`, use the image/surface path exposed by
      `@sdl3/sdl3-deno`, or generate raw image modules if the binding requires
      real byte buffers.
    - Convert the decoded surface/image data to an SDL3 texture.
    - Cache texture by id.
    - Free intermediate surfaces after texture creation if the binding exposes
      `free()`.
6. Remove direct image objects from `SpriteSheet`; store `TextureHandle` plus
   `TextureAtlasLayout`.

Done when:

- Player base sheet, cape sheets, sword sheet, and item icons load in SDL3.
- Texture dimensions are validated against `TextureAtlasLayout`.
- Missing asset errors include asset id and resolved path.

## Phase 5 - Replace Canvas 2D Drawing With Renderer Commands

Goal: make every game layer render through `Renderer2D`.

Layer-by-layer conversion order:

1. `TerrainLayer`
    - `fillRect` -> `renderer.fillRect`.
    - top/bottom pixel highlights -> `fillRect` with 1px height.
2. `EntityLayer`
    - sprite draw -> `renderer.drawTexture`.
    - item draw -> `renderer.drawTexture`.
    - ground shadow: replace ellipse gradient with one of:
        - a prebuilt shadow texture, preferred for SDL3.
        - a simple alpha rectangle until texture support lands.
    - subtle aura: delete temporarily or replace with an aura texture.
3. `BackgroundLayer`
    - replace linear gradient with either:
        - vertical bands of solid color, temporary.
        - pre-rendered background texture, preferred.
4. `DebugLayer`
    - `strokeRect` -> `renderer.strokeRect`.
    - rays -> `renderer.drawLine`.
    - radius circles: approximate with a 32-segment polyline helper.
5. `LightingLayer`, after terrain/entities/debug are working in SDL3
    - Stop relying on `globalCompositeOperation = 'destination-out'`.
    - Implement a CPU-generated light mask texture or a simpler first SDL3 pass:
        - draw dark overlay bands/rectangles.
        - draw visibility polygons as tinted transparent triangles only if SDL3
          blend mode supports it.
    - Keep ray casting engine-owned; only the mask compositing is platform/render
      specific.

Done when:

- `rg -n "createLinearGradient|createRadialGradient|globalCompositeOperation|ellipse|drawImage|CanvasRenderingContext" packages/game/src packages/engine/src` finds no required runtime code outside browser preview.
- SDL3 renders terrain, player, items, debug collision, and basic lighting.

## Phase 6 - Deno Game Entrypoint

Goal: `packages/game` runs directly with Deno + SDL3.

1. Add SDL3 tasks to `packages/game/deno.json` without deleting the browser
   preview path immediately:
    - `dev:sdl`
    - `compile:mac`
    - `compile:win`
2. Add `main.sdl.ts` first, then make `main.ts` SDL3 after parity. Move browser
   preview to `main.browser.ts`.
3. Introduce the smallest engine boot abstraction needed to share content,
   world, input, and render layer setup across browser and SDL3.
4. Target shape:

```ts
import { createEngine } from '@sidebound/engine'
import { createSdlRuntime } from '@sidebound/platform-sdl'

import { game } from './game.ts'

const runtime = await createSdlRuntime({
    appId: 'sidebound.debug-harness',
    window: {
        title: 'Sidebound Debug Harness',
        width: 450,
        height: 250,
    },
    assets: {
        root: new URL('../assets/', import.meta.url),
    },
})

const engine = await createEngine({ runtime, game })
await engine.run()
```

5. Add `packages/game/src/game.ts` with the content registry, world, renderer
   layer list, and debug-scene list.

Done when:

- `deno task --config packages/game/deno.json check` passes.
- `deno task --config packages/game/deno.json dev:sdl` runs the debug room, or
  `dev` does after the final cutover.

## Phase 7 - Package Native Libraries

Goal: make compiled artifacts runnable on clean machines.

macOS:

1. Require local dev dependency install:

```sh
brew install sdl3 sdl3_image
```

2. Support `DENO_SDL3_PATH=/opt/homebrew/lib/` and
   `DENO_SDL3_PATH=/usr/local/lib/`.
3. Compile:

```sh
deno task --config packages/game/deno.json compile:mac
```

4. Create a `.app` bundle only after the raw executable works.
5. Later: codesign/notarize the `.app`.

Windows:

1. Compile target:

```sh
deno task --config packages/game/deno.json compile:win
```

2. Bundle beside the `.exe`:
    - SDL3 runtime DLLs required by `@sdl3/sdl3-deno`.
    - SDL3_image or other image-loading DLLs if the texture path uses them.
3. Use `--icon assets/app.ico` once an icon exists.

Linux:

1. Compile target:

```sh
deno compile --target x86_64-unknown-linux-gnu --allow-read --allow-env --allow-ffi --include assets --output ../../dist/sidebound src/main.ts
```

2. Document required system packages:
    - SDL3 runtime package.
    - SDL3 image package if texture loading depends on it.
3. AppImage/Flatpak packaging comes later.

Done when:

- A macOS local executable runs from `dist/`.
- The release folder documents required native library placement.
- CI can at least `deno check` the SDL3 entrypoint.

## Phase 8 - Delete Browser Runtime

Goal: SDL3 is the only real runtime layer.

1. Root `deno.json` tasks:
    - `dev` -> Deno SDL3 task.
    - delete `dev:browser` after SDL3 parity unless a temporary migration task
      is still needed.
    - `check` -> Deno checks and lint, including `packages/platform-sdl` when
      native binding availability is reliable in CI.
2. Delete `packages/platform-browser` and `packages/game/index.html`.
3. Delete browser-only build/serve tools once SDL3 compile/package tasks replace
   them.
4. Keep `agents/roadmap.md` runtime notes aligned with SDL3 as the only
   supported runtime layer.

Done when:

- `deno task --config packages/game/deno.json dev` is the normal way to run the
  debug harness.
- Browser preview has been deleted from the main engine workspace.
- No engine API names, types, or docs describe Canvas2D as the normal rendering
  path.
- No workspace task depends on DOM, Canvas2D, Web Audio, or browser serving.

## Phase 9 - Tests And CI

Add checks before deleting browser fallback:

1. Engine pure tests:
    - geometry helpers.
    - camera bounds and snapping.
    - input frame reducer.
    - sprite animation progression.
    - content validation.
    - world validation.
    - ray lighting cast counts and polygon sorting.
2. Renderer contract tests:
    - fake `Renderer2D` records commands from `RenderPipeline`.
    - sprite draw emits correct source/destination rects.
    - debug layer emits rect/line commands.
3. SDL3 smoke test:
    - create hidden window if supported.
    - create renderer.
    - create texture from one tiny generated surface.
    - present one frame.
4. CI matrix:
    - `deno task check`.
    - `deno task build` while browser preview exists.
    - `deno check packages/platform-sdl/src/mod.ts`.
    - `deno check packages/game/src/main.ts`.

## Exact Current-Code Moves

Use this as the remaining move list:

| Current file/path                                | Target                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `packages/engine/src/platform/{clock,input-source,renderer,storage,loop}.ts` | Rename/move to `packages/engine/src/runtime/*` as engine-owned contracts, not multi-platform promises. |
| `packages/engine/src/platform/adapter.ts`        | Delete after assets/sprites/lighting stop depending on browser-preview types.                    |
| `packages/engine/src/platform/render-context.ts` | Delete after engine-owned usage moves to `Renderer2D` commands.                                  |
| `packages/engine/src/assets/asset-store.ts`      | Replace `ImageSource` loading with platform-neutral image asset payloads and texture handles.     |
| `packages/engine/src/sprites/*`                  | Draw through `Renderer2D.drawTexture` instead of `RenderContext.drawImage`.                       |
| `packages/engine/src/rendering/layers/lighting.ts` | Split ray casting from browser compositing; add SDL3-compatible mask/texture path.                |
| `packages/engine/src/diagnostics/diagnostics.ts` | Convert overlay hooks to renderer commands; delete browser-only hooks.                           |
| `packages/game/src/rendering/layers/*`           | Convert terrain/entity/debug/background drawing to `Renderer2D` commands or textures.             |
| `packages/game/src/debug/debug-panel.ts`         | Replace with SDL3/platform debug overlay or delete.                                              |
| `packages/game/src/debug/debug-minimap.ts`       | Convert to `Renderer2D` commands or SDL3 texture.                                                |
| `packages/game/src/systems/audio.ts`             | Replace with SDL3/platform audio; delete browser copy after transition.                           |
| `packages/game/src/main.ts`                      | Deno SDL3 entrypoint after parity.                                                               |
| `packages/game/index.html`                       | Delete after SDL3 is default.                                                                    |

## Next SDL3 Milestone Scope

Do not try to port every visual effect at once.

The next SDL3 milestone must show:

- Player sprite.
- Item sprite.
- Terrain rectangles.
- Camera follow.
- Keyboard movement and jump.
- Collision debug boxes.
- Quit handling.

The next SDL3 milestone may temporarily omit:

- Gradients.
- Aura.
- Smooth ground shadow.
- Full light-mask compositing.
- DOM debug panel.
- Audio.
- Minimap.

## Cutover Criteria

SDL3 becomes the default when all are true:

1. `deno task --config packages/game/deno.json dev` runs the debug room.
2. Player movement, gravity, AABB collision, camera follow, sprite animation,
   item pickups, and debug collision overlay work.
3. `deno compile` produces a local macOS executable that runs outside the repo
   when native libraries are available.
4. `packages/engine/src` contains no browser or SDL3 imports.
5. Browser runtime is deleted from the main engine workspace.

## Risks

- SDL3 rendering is not Canvas 2D. Gradients, compositing, text metrics, and
  clipping must be replaced, approximated, or moved to texture/render-target
  code.
- `@sdl3/sdl3-deno` is FFI-backed and may have breaking changes. Pin exact JSR
  versions and isolate all imports in `packages/platform-sdl`.
- `deno compile` can include assets, but native SDL libraries still need
  platform packaging.
- Cross-compilation creates the executable, not the native dependency bundle.
- Current lighting relies on canvas compositing. It needs a renderer-owned light
  mask path before parity is realistic.

## Recommended Order For The Next Agent

1. Finish removing `Canvas2DPreview` dependencies from engine-owned sprites,
   assets, diagnostics, and lighting.
2. Implement SDL3 texture loading and `drawTexture`.
3. Convert game render layers to `Renderer2D` command calls.
4. Load one player sprite sheet as an SDL3 texture.
5. Run the existing demo room in SDL3 with lighting temporarily disabled.
6. Add SDL3 debug collision overlay.
7. Rebuild lighting as an SDL3-compatible mask or texture path.
8. Make `deno compile` work on macOS.
