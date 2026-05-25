# Deno + SDL Migration Plan

## Intent

Move `sidebound` from a browser-preview-first runtime to a Deno executable
runtime backed by SDL2. The browser preview may remain as a development adapter,
but it must not define engine architecture.

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
- `@divy/sdl2` is the practical SDL2 binding to target first. It exposes
  `WindowBuilder`, `Window.events()`, `Canvas`, `TextureCreator`, `Surface`,
  `Texture`, `Rect`, and `EventType`.
- `littledivy/flappybird` proves the shape: Deno + SDL2 + `deno compile`, with
  images embedded as generated JS and native SDL libraries installed or bundled
  beside the executable.

Reference links:

- Deno compile docs: https://docs.deno.com/runtime/reference/cli/compile/
- Deno FFI docs: https://docs.deno.com/runtime/fundamentals/ffi/
- `@divy/sdl2` docs: https://jsr.io/@divy/sdl2/doc
- Deno compile blog / Flappy Bird example: https://deno.com/blog/deno-compile-executable-programs
- Example repo: https://github.com/littledivy/flappybird

## Non-Negotiables

- `packages/engine` must not import `@divy/sdl2`, `Deno`, `document`, `window`,
  `HTMLCanvasElement`, `CanvasRenderingContext2D`, Web Audio, `localStorage`, or
  browser-preview tooling APIs.
- `packages/game` must become a Deno debug harness. It may define demo content,
  debug scenes, and platform choice, but it must not own reusable engine systems.
- SDL-specific code belongs in `packages/platform-sdl`.
- Browser-specific code belongs in `packages/platform-browser-preview` or an
  explicitly named `browser-preview` submodule. It must not remain mixed into
  engine core.
- Rendering migration must use explicit renderer commands or renderer interfaces.
  Do not keep pretending an SDL canvas is a DOM-like canvas 2D context.
- Each phase must keep either the browser harness or the SDL harness runnable.
  Prefer a temporary dual-runtime period over a giant cutover.

## Target Package Layout

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
      platform/
        clock.ts
        input-source.ts
        renderer.ts
        storage.ts
      rendering/
        commands.ts
        pipeline.ts
        renderer.ts
        sprites.ts
      sprites/
      world/

  platform-sdl/
    deno.json
    src/
      mod.ts
      app.ts
      assets.ts
      clock.ts
      input.ts
      renderer.ts
      sdl-types.ts
      storage.ts
      window.ts

  platform-browser-preview/
    deno.json
    src/
      mod.ts
      app.ts
      assets.ts
      clock.ts
      input.ts
      renderer-canvas2d.ts
      storage.ts

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

## Target Runtime APIs

Engine code should see these interfaces, not SDL or DOM classes.

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
    update(deltaSeconds: number): void
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

Goal: make engine runtime interfaces honest before SDL code exists.

1. In `packages/engine/src/platform`, split the current platform types:
    - `clock.ts`: `EngineClock`, `AnimationFrameClock` only if browser preview
      still needs it.
    - `renderer.ts`: `Renderer2D`, `RenderFrame`, `TextureHandle`,
      `RenderTargetHandle`, `DrawOptions`.
    - `input-source.ts`: `InputSource`, `InputEvents`, pointer/key event types.
    - `storage.ts`: `KeyValueStorage`.
2. Rename the current `PlatformAdapter` to `Canvas2DPreviewPlatform` or delete
   it after its responsibilities are moved.
3. Replace `RenderContext` in engine-owned code with `Renderer2D` where possible.
   Keep a temporary `Canvas2DRenderContext` only inside browser preview.
4. Change `RenderLayer` from:

```ts
render(context: RenderContext, camera: Rect): void
```

to:

```ts
render(frame: RenderFrame): void
```

5. Keep `RenderPipeline.update(deltaSeconds)` unchanged.
6. Move all browser-only classes from `packages/engine/src/platform/browser.ts`
   to `packages/platform-browser-preview/src`.
7. `packages/engine/src/mod.ts` must export only engine-owned interfaces and
   pure systems.

Done when:

- `rg -n "document|window|HTMLCanvas|CanvasRenderingContext|AudioContext|localStorage|requestAnimationFrame" packages/engine/src` returns nothing.
- `packages/game` still runs through the browser preview adapter.
- `deno task check && deno task build` passes through the mise-managed Deno toolchain.

## Phase 1.5 - Deno Workspace Cutover

Goal: make Deno the only active workspace toolchain before adding SDL code.

1. Select latest Deno through mise in `.mise.toml`.
2. Add root `deno.json` with workspace members, import/package names, lint,
   format, check, build, and browser-preview dev tasks.
3. Add package-level `deno.json` files for `packages/engine`,
   `packages/platform-browser-preview`, and `packages/game`.
4. Use `mod.ts` for module barrels, never `index.ts`; keep every `mod.ts`
   export-only and move implementation into named modules.
5. Replace extensionless local imports with explicit `.ts` or `/mod.ts`
   imports.
6. Remove pnpm/Node workspace metadata and TypeScript/ESLint/Prettier configs
   that duplicate Deno-owned tooling.
7. Remove Vite from the game harness; browser preview builds and serves through
   Deno and JSR packages only.

Done when:

- `mise exec -- deno task check` passes.
- `mise exec -- deno task build` builds the browser preview.
- `find packages -path '*/src/*' -name 'index.ts' -print` returns nothing.
- Live config and source contain no npm-prefixed imports and no Vite config.
- No `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig*.json`,
  or `eslint.config.ts` files remain.

## Phase 2 - Add `packages/platform-sdl`

Goal: create a minimal SDL window that can clear, present, and exit.

1. Add `packages/platform-sdl/deno.json`:

```json
{
    "tasks": {
        "check": "deno check src/mod.ts",
        "dev": "deno run --allow-read --allow-env --allow-ffi src/dev.ts",
        "compile:mac": "deno compile --allow-read --allow-env --allow-ffi --include ../../packages/game/assets --output ../../dist/sidebound src/dev.ts",
        "compile:win": "deno compile --target x86_64-pc-windows-msvc --allow-read --allow-env --allow-ffi --include ../../packages/game/assets --output ../../dist/sidebound.exe src/dev.ts"
    },
    "imports": {
        "@divy/sdl2": "jsr:@divy/sdl2@0.15.0",
        "@sidebound/engine": "../engine/src/mod.ts"
    }
}
```

2. Add `packages/platform-sdl/src/window.ts`:
    - Import `WindowBuilder` and `EventType` from `@divy/sdl2`.
    - Create a window with logical size.
    - Expose `window.canvas()` as the SDL drawing backend.
    - Expose `for await (const event of window.events())` through a runtime
      `run()` loop.
3. Add `packages/platform-sdl/src/renderer.ts`:
    - `beginFrame(clearColor)` calls `canvas.setDrawColor(...)` then
      `canvas.clear()`.
    - `endFrame()` calls `canvas.present()`.
    - Implement `fillRect`, `strokeRect`, `drawLine`, and texture copy first.
4. Add `packages/platform-sdl/src/mod.ts`:

```ts
export { createSdlRuntime } from './app.ts'
```

5. Add a tiny dev entry in `packages/platform-sdl/src/dev.ts` that opens a
   450x250 window, clears it, draws one rectangle, and exits on quit.

Done when:

- `deno task --config packages/platform-sdl/deno.json check` passes.
- `deno task --config packages/platform-sdl/deno.json dev` opens a window,
  renders a rectangle, and exits cleanly.

## Phase 3 - SDL Event Loop And Input

Goal: SDL owns runtime events; engine receives typed input frames.

1. Implement SDL event conversion in `packages/platform-sdl/src/input.ts`.
2. Map SDL events:
    - `EventType.Quit` -> `quitRequested = true`.
    - `EventType.KeyDown` -> `keysDown`, `keysHeld.add(key)`.
    - `EventType.KeyUp` -> `keysUp`, `keysHeld.delete(key)`.
    - `EventType.MouseButtonDown` -> `pointerDown`.
    - `EventType.MouseButtonUp` -> `pointerUp`.
3. Normalize key names into the existing `InputManager` vocabulary:
    - SDL space scancode -> `' '`.
    - left/right/up/down -> `'arrowleft'`, `'arrowright'`, `'arrowup'`,
      `'arrowdown'`.
    - letter keys -> lowercase letters.
4. Replace `InputManager`'s browser listener dependency with a source that can
   accept event batches from either SDL or browser preview.
5. The SDL runtime loop should have this control flow:

```ts
for await (const event of window.events()) {
    inputQueue.push(event)

    if (event.type !== EventType.Draw) {
        continue
    }

    const inputEvents = inputQueue.flush()
    runtimeInput.apply(inputEvents)
    loop.update(deltaSeconds)
    renderer.beginFrame(clearColor)
    loop.render({ renderer, camera })
    renderer.endFrame()
}
```

6. Do not use `Atomics.wait()` as the long-term frame limiter. Use SDL draw
   events first. If draw events are too fast, add an `EngineClock.sleep(ms)`
   implementation in the SDL runtime and document why.

Done when:

- SDL harness can quit via window close.
- Keyboard left/right/jump input affects the player.
- Browser preview input still works.

## Phase 4 - Texture And Asset Loading

Goal: load game images as SDL textures through the asset layer.

1. Replace `ImageSource` with an engine-owned asset payload:

```ts
export type ImageAssetSource = { kind: 'file'; path: string } | { kind: 'bytes'; bytes: Uint8Array; mimeType: string }
```

2. Update content asset definitions to use stable asset ids and relative paths:

```ts
{ id: 'characters/player/base', path: 'assets/sprites/player-base.png' }
```

3. For development, `SdlAssetLoader` reads files from
   `packages/game/assets/...` using `Deno.readFile`.
4. For compiled executables, support both:
    - `deno compile --include packages/game/assets`.
    - generated asset modules if SDL image loading requires real byte buffers.
5. Implement `SdlRenderer.loadTexture(id, source)`:
    - If `source.kind === 'file'`, prefer `Surface.fromFile(path)` if supported.
    - If `source.kind === 'bytes'`, use `Surface.fromRaw(...)` or a generated raw
      image module, matching `@divy/sdl2` capabilities.
    - Convert surface to texture via `canvas.textureCreator().createTextureFromSurface(surface)`.
    - Cache texture by id.
    - Free intermediate surfaces after texture creation if the binding exposes
      `free()`.
6. Remove direct image objects from `SpriteSheet`; store `TextureHandle` plus
   `TextureAtlasLayout`.

Done when:

- Player base sheet, cape sheets, sword sheet, and item icons load in SDL.
- Texture dimensions are validated against `TextureAtlasLayout`.
- Missing asset errors include asset id and resolved path.

## Phase 5 - Replace Canvas 2D Drawing With Renderer Commands

Goal: make every current layer render through `Renderer2D`.

Layer-by-layer conversion:

1. `TerrainLayer`
    - `fillRect` -> `renderer.fillRect`.
    - top/bottom pixel highlights -> `fillRect` with 1px height.
2. `EntityLayer`
    - sprite draw -> `renderer.drawTexture`.
    - item draw -> `renderer.drawTexture`.
    - ground shadow: replace ellipse gradient with one of:
        - a prebuilt shadow texture, preferred for SDL.
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
5. `LightingLayer`
    - Stop relying on `globalCompositeOperation = 'destination-out'`.
    - Implement a CPU-generated light mask texture or a simpler first SDL pass:
        - draw dark overlay bands/rectangles.
        - draw visibility polygons as tinted transparent triangles only if SDL
          blend mode supports it.
    - Keep ray casting engine-owned; only the mask compositing is platform/render
      specific.

Done when:

- `rg -n "createLinearGradient|createRadialGradient|globalCompositeOperation|ellipse|drawImage|CanvasRenderingContext" packages/game/src packages/engine/src` finds no required runtime code outside browser preview.
- SDL renders terrain, player, items, debug collision, and basic lighting.

## Phase 6 - Deno Game Entrypoint

Goal: `packages/game` runs directly with Deno + SDL.

1. Add `packages/game/deno.json`:

```json
{
    "tasks": {
        "check": "deno check src/main.ts",
        "dev": "deno run --allow-read --allow-env --allow-ffi src/main.ts",
        "compile:mac": "deno compile --allow-read --allow-env --allow-ffi --include assets --output ../../dist/sidebound src/main.ts",
        "compile:win": "deno compile --target x86_64-pc-windows-msvc --allow-read --allow-env --allow-ffi --include assets --output ../../dist/sidebound.exe src/main.ts"
    },
    "imports": {
        "@sidebound/engine": "../engine/src/mod.ts",
        "@sidebound/platform-sdl": "../platform-sdl/src/mod.ts"
    },
    "compile": {
        "include": ["assets"]
    }
}
```

2. Replace `packages/game/src/main.ts` with:

```ts
import { createEngine } from '@sidebound/engine'
import { createSdlRuntime } from '@sidebound/platform-sdl'

import { game } from './game.ts'

const runtime = await createSdlRuntime({
    appId: 'sidebound.debug-harness',
    window: {
        title: 'Sidebound Debug Harness',
        logicalSize: [450, 250],
        pixelScale: 'integer-fit',
        resizable: true,
    },
    assets: {
        root: new URL('../assets/', import.meta.url),
    },
})

const engine = await createEngine({ runtime, game })
await engine.run()
```

3. Add `packages/game/src/game.ts` with the current content registry, world,
   renderer layer list, and debug-scene list.
4. Keep the browser preview entrypoint separately named:
   `packages/game/src/main.browser.ts`.

Done when:

- `deno task --config packages/game/deno.json check` passes.
- `deno task --config packages/game/deno.json dev` runs the current debug room.

## Phase 7 - Package Native Libraries

Goal: make compiled artifacts runnable on clean machines.

macOS:

1. Require local dev dependency install:

```sh
brew install sdl2 sdl2_image sdl2_ttf
```

2. Support `DENO_SDL2_PATH=/opt/homebrew/lib/` and
   `DENO_SDL2_PATH=/usr/local/lib/`.
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
    - `SDL2.dll`
    - `SDL2_image.dll`
    - any transitive DLLs required by SDL2_image.
3. Use `--icon assets/app.ico` once an icon exists.

Linux:

1. Compile target:

```sh
deno compile --target x86_64-unknown-linux-gnu --allow-read --allow-env --allow-ffi --include assets --output ../../dist/sidebound src/main.ts
```

2. Document required system packages:
    - `libsdl2`
    - `libsdl2-image`
    - `libsdl2-ttf`
3. AppImage/Flatpak packaging comes later.

Done when:

- A macOS local executable runs from `dist/`.
- The release folder documents required native library placement.
- CI can at least `deno check` the SDL entrypoint.

## Phase 8 - Remove Browser As The Main Harness

Goal: SDL is the primary harness; browser is optional.

1. Root `deno.json` tasks:
    - `dev` -> Deno SDL task.
    - `dev:browser` -> browser preview task.
    - `check` -> Deno checks and lint.
2. `packages/game/index.html` moves to `packages/platform-browser-preview` or
   `packages/game/browser-preview`.
3. Update `agents/roadmap.md` Phase 0/1 notes to mark browser preview as
   secondary.

Done when:

- `deno task --config packages/game/deno.json dev` is the normal way to run the
  debug harness.
- Browser preview can be deleted without changing engine or game logic.

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
3. SDL smoke test:
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

Perform these after Phase 1 interfaces exist:

| Current file                                     | Target                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `packages/engine/src/platform/browser.ts`        | `packages/platform-browser-preview/src/app.ts`, `renderer-canvas2d.ts`, `clock.ts`, `assets.ts` |
| `packages/engine/src/platform/adapter.ts`        | split into `packages/engine/src/platform/renderer.ts`, `assets.ts`, `storage.ts`                |
| `packages/engine/src/platform/render-context.ts` | replace with `packages/engine/src/rendering/renderer.ts` command API                            |
| `packages/game/src/debug/debug-panel.ts`         | keep browser-only; build SDL debug overlay later                                                |
| `packages/game/src/debug/debug-minimap.ts`       | convert to `Renderer2D` commands or SDL texture                                                 |
| `packages/game/src/systems/audio.ts`             | move to browser preview; replace with SDL audio later                                           |
| `packages/game/src/main.ts`                      | Deno SDL entrypoint                                                                             |
| `packages/game/index.html`                       | browser preview only                                                                            |

## First SDL Milestone Scope

Do not try to port every visual effect at once.

The first SDL milestone must show:

- One window.
- Pixel-art logical resolution.
- Player sprite.
- Item sprite.
- Terrain rectangles.
- Camera follow.
- Keyboard movement and jump.
- Collision debug boxes.
- Quit handling.

The first SDL milestone may temporarily omit:

- Gradients.
- Aura.
- Smooth ground shadow.
- Full light-mask compositing.
- DOM debug panel.
- Audio.
- Minimap.

## Cutover Criteria

SDL becomes the default when all are true:

1. `deno task --config packages/game/deno.json dev` runs the current debug room.
2. Player movement, gravity, AABB collision, camera follow, sprite animation,
   item pickups, and debug collision overlay work.
3. `deno compile` produces a local macOS executable that runs outside the repo
   when native libraries are available.
4. `packages/engine/src` contains no browser or SDL imports.
5. Browser preview is clearly optional and shares engine/game definitions with
   SDL.

## Risks

- SDL2 canvas is not Canvas 2D. Gradients, compositing, text metrics, and
  clipping must be replaced, approximated, or moved to texture/render-target
  code.
- `@divy/sdl2` is FFI-backed and may have breaking changes. Pin exact JSR
  versions and isolate all imports in `packages/platform-sdl`.
- `deno compile` can include assets, but native SDL libraries still need
  platform packaging.
- Cross-compilation creates the executable, not the native dependency bundle.
- Current lighting relies on canvas compositing. It needs a renderer-owned light
  mask path before parity is realistic.

## Recommended Order For The Next Agent

1. Finish Phase 1 and Phase 1.5 before creating SDL code.
2. Add `packages/platform-sdl` and render a rectangle.
3. Convert render layers to `Renderer2D` command calls.
4. Load one sprite sheet as an SDL texture.
5. Run the existing demo room in SDL with no lighting.
6. Add debug collision overlay.
7. Rebuild lighting as an SDL-compatible mask.
8. Make `deno compile` work on macOS.
