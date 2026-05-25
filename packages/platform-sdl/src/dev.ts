/**
 * Minimal SDL3 dev harness.
 * Opens a 450x250 window, clears to dark purple, draws a white rectangle,
 * and exits cleanly on window close or Escape.
 */

import { createSdlRuntime } from './app.ts'

const runtime = createSdlRuntime({
    appId: 'sidebound.sdl-dev',
    window: {
        title: 'Sidebound SDL3 Dev',
        width: 450,
        height: 250,
    },
    clearColor: { r: 30, g: 26, b: 46, a: 1 },
})

console.log('[SDL3 Dev] Window opened — press Escape or close window to exit.')

await runtime.run({
    update(_deltaSeconds, input) {
        if (input.keysHeld.has('escape')) {
            runtime.dispose()
            Deno.exit(0)
        }
    },

    render({ renderer }) {
        // Draw a white rectangle in the center
        renderer.fillRect(
            { x: 175, y: 100, width: 100, height: 50 },
            { r: 255, g: 255, b: 255, a: 1 },
        )

        // Draw a green outlined rectangle
        renderer.strokeRect(
            { x: 50, y: 50, width: 80, height: 40 },
            { r: 100, g: 255, b: 150, a: 1 },
        )

        // Draw a diagonal line
        renderer.drawLine(
            { x: 350, y: 30 },
            { x: 420, y: 220 },
            { r: 255, g: 200, b: 80, a: 1 },
        )
    },
})

console.log('[SDL3 Dev] Exited cleanly.')
