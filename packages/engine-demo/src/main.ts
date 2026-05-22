import { PixelEngine } from '@strange-path/engine'
import { DemoAudio } from './systems/audio'
import { SideViewCamera } from './systems/camera'
import { DebugPanel } from './debug/debug-panel'
import { world, viewport } from './world/demo-map'
import { requireElement } from './core/dom'
import { smooth } from './core/geometry'
import { GameInput } from './systems/input'
import { RayLighting } from './systems/lighting'
import { PlayerMob } from './entities/player-mob'
import { DemoRenderer } from './rendering/renderer'
import './style.css'

const canvas = requireElement<HTMLCanvasElement>('#game')
const debugPanel = new DebugPanel()
const input = new GameInput(debugPanel.root)
const audio = new DemoAudio(debugPanel.soundPreferred)
const player = new PlayerMob(world.spawn, world.solids)
const camera = new SideViewCamera(world, viewport)
const lighting = new RayLighting(world.solids)
const renderer = new DemoRenderer(world)
const diagnostics = {
    fps: 0,
    frameMs: 0,
    updateMs: 0,
    renderMs: 0,
    rayMs: 0,
    rays: 0,
    rayChecks: 0,
}

debugPanel.setSoundButtonState(audio.state)
debugPanel.setSoundToggleHandler(() => audio.toggle())
debugPanel.start()
input.start()
camera.snapToPlayer(player)

const engine = new PixelEngine({
    canvas,
    width: viewport.width,
    height: viewport.height,
    scale: 'css',
    background: '#1e1a2e',
    loop: {
        update(deltaSeconds) {
            const updateStart = performance.now()
            const safeDeltaSeconds = Math.min(deltaSeconds, 0.05)

            diagnostics.frameMs = smooth(diagnostics.frameMs, deltaSeconds * 1000, 0.12)
            diagnostics.fps = smooth(diagnostics.fps, 1 / Math.max(deltaSeconds, 0.0001), 0.12)

            for (const cue of player.update(safeDeltaSeconds, input.readPlayerFrame())) {
                audio.playTone(cue)
            }

            camera.update(safeDeltaSeconds, player)
            diagnostics.updateMs = performance.now() - updateStart
        },
        render(context) {
            const renderStart = performance.now()
            const cameraRect = camera.getRect()

            context.save()
            context.translate(-cameraRect.x, -cameraRect.y)
            renderer.drawArea(context)

            const rayStart = performance.now()
            const lightOrigin = player.getLightOrigin()
            const light = lighting.cast(lightOrigin, player.lightRadius)

            diagnostics.rayMs = performance.now() - rayStart
            diagnostics.rays = light.rays
            diagnostics.rayChecks = light.rayChecks

            renderer.drawLighting(context, light.polygon, lightOrigin, cameraRect, player.lightRadius)

            // Draw player on top of lighting so the sprite is always visible
            renderer.drawMob(context, player)

            if (debugPanel.showLighting) {
                renderer.drawLightingDebug(context, light.polygon, lightOrigin, player.lightRadius)
            }

            if (debugPanel.showCollision) {
                renderer.drawCollisionDebug(context, player.getRect())
            }

            context.restore()

            diagnostics.renderMs = performance.now() - renderStart
            debugPanel.updateMetrics({
                ...diagnostics,
                grounded: player.grounded,
                velocity: {
                    x: player.vx,
                    y: player.vy,
                },
            })
        },
    },
})

engine.start()
