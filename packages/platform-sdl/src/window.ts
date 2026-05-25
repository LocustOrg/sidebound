/**
 * SDL3 window management. Creates and configures a window with logical pixel resolution.
 */

import { Render, SdlContext, Window } from '@sdl3/sdl3-deno'

export type SdlWindowConfig = {
    readonly title: string
    readonly width: number
    readonly height: number
}

export type SdlWindowHandle = {
    readonly sdl: SdlContext
    readonly window: Window
    readonly renderer: Render
}

export function createSdlWindow(config: SdlWindowConfig): SdlWindowHandle {
    const sdl = new SdlContext()
    const window = Window.create(config.title, config.width, config.height, 0n)
    const renderer = new Render(null as unknown as Deno.PointerValue<'SDL_Renderer'>)
    const created = renderer.create(window)
    return { sdl, window, renderer: created }
}
