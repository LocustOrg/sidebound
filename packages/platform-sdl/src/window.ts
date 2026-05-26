/**
 * SDL3 window management. Creates and configures a window with logical pixel resolution.
 */

import { Render, SdlContext, Window } from '@sdl3/sdl3-deno'

/** SDL_WINDOW_RESIZABLE flag */
const SDL_WINDOW_RESIZABLE = 0x20n

export type SdlWindowConfig = {
    readonly title: string
    readonly width: number
    readonly height: number
    readonly resizable?: boolean
}

export type SdlWindowHandle = {
    readonly sdl: SdlContext
    readonly window: Window
    readonly renderer: Render
}

export function createSdlWindow(config: SdlWindowConfig): SdlWindowHandle {
    const sdl = new SdlContext()
    const flags = config.resizable ? SDL_WINDOW_RESIZABLE : 0n
    const window = Window.create(config.title, config.width, config.height, flags)
    const renderer = new Render(null as unknown as Deno.PointerValue<'SDL_Renderer'>)
    const created = renderer.create(window)
    return { sdl, window, renderer: created }
}
