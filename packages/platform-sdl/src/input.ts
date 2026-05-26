/**
 * SDL3 input: converts SDL events into engine InputEvents frames.
 */

import { type Event, EventType, SDLK } from '@sdl3/sdl3-deno'
import type { InputEvents, PointerEventFrame, WindowResizeEvent } from '@sidebound/engine'

/**
 * Maps an SDL3 keycode to the engine's normalized key string.
 * Engine uses lowercase web-style names: 'arrowleft', 'arrowright', etc.
 */
function normalizeKey(keycode: number): string {
    switch (keycode) {
        case SDLK.LEFT:
            return 'arrowleft'
        case SDLK.RIGHT:
            return 'arrowright'
        case SDLK.UP:
            return 'arrowup'
        case SDLK.DOWN:
            return 'arrowdown'
        case SDLK.SPACE:
            return ' '
        case SDLK.ESCAPE:
            return 'escape'
        case SDLK.RETURN:
            return 'enter'
        case SDLK.F1:
            return 'f1'
        case SDLK.F2:
            return 'f2'
        case SDLK.F3:
            return 'f3'
        case SDLK.F4:
            return 'f4'
        case SDLK.F5:
            return 'f5'
        case SDLK.F6:
            return 'f6'
        case SDLK.F7:
            return 'f7'
        case SDLK.F8:
            return 'f8'
        case SDLK.F9:
            return 'f9'
        case SDLK.F10:
            return 'f10'
        case SDLK.F11:
            return 'f11'
        case SDLK.F12:
            return 'f12'
        default:
            // For printable ASCII keys, SDL3 keycodes match the char code
            if (keycode >= 97 && keycode <= 122) {
                return String.fromCharCode(keycode)
            }
            if (keycode >= 65 && keycode <= 90) {
                return String.fromCharCode(keycode + 32)
            }
            return String.fromCharCode(keycode).toLowerCase()
    }
}

/** SDL_EVENT_WINDOW_RESIZED */
const SDL_EVENT_WINDOW_RESIZED = 0x806

export class SdlInputQueue {
    private readonly keysHeld = new Set<string>()
    private keysDown: string[] = []
    private keysUp: string[] = []
    private pointerDown: PointerEventFrame[] = []
    private pointerUp: PointerEventFrame[] = []
    private quit = false
    private resized: WindowResizeEvent | null = null

    push(event: Event): void {
        const type = event.common.type

        switch (type) {
            case EventType.QUIT:
                this.quit = true
                break

            case EventType.KEY_DOWN: {
                const kb = event.keyboard
                if (!kb.repeat) {
                    const key = normalizeKey(kb.key)
                    this.keysDown.push(key)
                    this.keysHeld.add(key)
                }
                break
            }

            case EventType.KEY_UP: {
                const kb = event.keyboard
                const key = normalizeKey(kb.key)
                this.keysUp.push(key)
                this.keysHeld.delete(key)
                break
            }

            case EventType.MOUSE_BUTTON_DOWN: {
                const mb = event.mouseButton
                this.pointerDown.push({
                    id: mb.button,
                    position: { x: mb.x, y: mb.y },
                    button: mb.button,
                })
                break
            }

            case EventType.MOUSE_BUTTON_UP: {
                const mb = event.mouseButton
                this.pointerUp.push({
                    id: mb.button,
                    position: { x: mb.x, y: mb.y },
                    button: mb.button,
                })
                break
            }

            default: {
                // Window resize event (SDL3: SDL_EVENT_WINDOW_RESIZED = 0x806)
                if (type === SDL_EVENT_WINDOW_RESIZED) {
                    const win = event.window
                    this.resized = { width: win.data1, height: win.data2 }
                }
                break
            }
        }
    }

    flush(): InputEvents {
        const events: InputEvents = {
            quitRequested: this.quit,
            keysDown: this.keysDown,
            keysUp: this.keysUp,
            keysHeld: new Set(this.keysHeld),
            pointerDown: this.pointerDown,
            pointerUp: this.pointerUp,
            windowResized: this.resized,
        }

        this.keysDown = []
        this.keysUp = []
        this.pointerDown = []
        this.pointerUp = []
        this.resized = null

        return events
    }
}
