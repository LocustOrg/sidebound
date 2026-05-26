/**
 * SDL3 runtime factory. Creates and returns an EngineRuntime that drives
 * the game loop through SDL3 event polling.
 */

import { Event, EventType } from '@sdl3/sdl3-deno'
import type { ColorRgba, InputEvents, Renderer2D, RenderFrame } from '@sidebound/engine'
import { createSdlWindow, type SdlWindowConfig } from './window.ts'
import { SdlRenderer } from './renderer.ts'
import { SdlInputQueue } from './input.ts'
import { SdlClock } from './clock.ts'
import { SdlAssetLoader, type SdlAssetLoaderOptions } from './assets.ts'
import { SdlFileStorage } from './storage.ts'

export type SdlRuntimeOptions = {
    readonly appId: string
    readonly window: SdlWindowConfig
    readonly assets?: SdlAssetLoaderOptions
    readonly storagePath?: string
    readonly clearColor?: ColorRgba
    readonly resizable?: boolean
}

export type SdlRuntimeLoop = {
    update(deltaSeconds: number, input: InputEvents): void
    render(frame: RenderFrame): void
}

export type SdlViewport = {
    readonly width: number
    readonly height: number
}

export type SdlRuntime = {
    readonly renderer: Renderer2D
    readonly assets: SdlAssetLoader
    readonly storage: SdlFileStorage
    readonly clock: SdlClock
    readonly viewport: SdlViewport
    run(loop: SdlRuntimeLoop): Promise<void>
    dispose(): void
}

const DEFAULT_CLEAR_COLOR: ColorRgba = { r: 30, g: 26, b: 46, a: 1 }

export function createSdlRuntime(options: SdlRuntimeOptions): SdlRuntime {
    const { window: windowConfig, clearColor = DEFAULT_CLEAR_COLOR, resizable = true } = options

    const { sdl, renderer: sdlRender } = createSdlWindow({ ...windowConfig, resizable })
    const renderer = new SdlRenderer(sdlRender, windowConfig.width, windowConfig.height)
    const inputQueue = new SdlInputQueue()
    const clock = new SdlClock()
    const assets = new SdlAssetLoader(options.assets ?? { root: new URL('./', import.meta.url) })
    const storage = new SdlFileStorage(options.storagePath ?? `./${options.appId}.storage.json`)

    const event = new Event()

    // Viewport tracks the actual window size — game sees more/less of the world as window resizes
    const viewport: { width: number; height: number } = { width: windowConfig.width, height: windowConfig.height }

    return {
        renderer,
        assets,
        storage,
        clock,
        get viewport() {
            return { width: viewport.width, height: viewport.height }
        },

        async run(loop: SdlRuntimeLoop): Promise<void> {
            let lastTime = clock.now()
            let running = true

            while (running) {
                // Poll all pending events
                while (event.poll()) {
                    inputQueue.push(event)

                    if (event.common.type === EventType.QUIT) {
                        running = false
                    }
                }

                if (!running) break

                const now = clock.now()
                const deltaSeconds = Math.min((now - lastTime) / 1000, 0.25)
                lastTime = now

                const input = inputQueue.flush()

                if (input.quitRequested) {
                    break
                }

                // Handle window resize — update viewport so game sees more/less of the world
                if (input.windowResized) {
                    viewport.width = input.windowResized.width
                    viewport.height = input.windowResized.height
                }

                loop.update(deltaSeconds, input)

                const camera = { x: 0, y: 0, width: viewport.width, height: viewport.height }
                renderer.beginFrame(clearColor)
                loop.render({ renderer, camera })
                renderer.endFrame()

                // Yield to avoid busy-spinning; ~16ms for ~60fps
                await clock.sleep(16)
            }
        },

        dispose(): void {
            renderer.dispose()
            sdl.quit()
        },
    }
}
