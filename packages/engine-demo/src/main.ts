import { PixelEngine } from '@strange-path/engine'
import { DemoAudio } from './systems/audio'
import { SideViewCamera } from './systems/camera'
import { DebugPanel } from './debug/debug-panel'
import { viewport, world } from './world/demo-map'
import { requireElement } from './core/dom'
import { smooth } from './core/geometry'
import { GameInput } from './systems/input'
import { RayLighting } from './systems/lighting'
import { PlayerMob } from './entities/player-mob'
import { RenderPipeline } from './rendering/pipeline'
import { BackgroundLayer } from './rendering/layers/background'
import { TerrainLayer } from './rendering/layers/terrain'
import { EntityLayer } from './rendering/layers/entity'
import { LightingLayer } from './rendering/layers/lighting'
import { DebugLayer } from './rendering/layers/debug'
import './style.css'

const canvas = requireElement<HTMLCanvasElement>('#game')
const debugPanel = new DebugPanel()
const input = new GameInput(debugPanel.root)
const audio = new DemoAudio(debugPanel.soundPreferred)
const player = new PlayerMob(world.spawn, world.solids)
const camera = new SideViewCamera(world, viewport)
const lighting = new RayLighting(world.solids)

// --- Layered Render Pipeline ---
const pipeline = new RenderPipeline()

const backgroundLayer = new BackgroundLayer(world)
const terrainLayer = new TerrainLayer(world)
const entityLayer = new EntityLayer()
const lightingLayer = new LightingLayer(lighting, viewport.width, viewport.height)
const debugLayer = new DebugLayer(world.solids)

entityLayer.addMob(player)
lightingLayer.setOriginProvider(() => ({
    origin: player.getLightOrigin(),
    radius: player.lightRadius,
}))
debugLayer.setPlayerRectProvider(() => player.getRect())
debugLayer.setLightPolygonProvider(() => ({
    polygon: lightingLayer['cachedPolygon'],
    origin: lightingLayer['cachedOrigin'],
    radius: lightingLayer['cachedRadius'],
}))

pipeline.addLayer(backgroundLayer)
pipeline.addLayer(terrainLayer)
pipeline.addLayer(entityLayer)
pipeline.addLayer(lightingLayer)
pipeline.addLayer(debugLayer)

/*
Add several new types of the objects to the map editor part. First I want to remove light from player but map must be still dark. Second I want to add sun the the top of the map. Third I want to add new type of tiles, that reflect light but player can go through them. And make map more pleasant to walk trough, add better spawning logic (sometimes player get sent to out-of-bounce), and make map editing with more elements, so that it is easier to create more complex layouts.
With that in mind, and dramatically better map, before implementing map optimization, let's create humongous map and see what is the rendering speed and whether we need optimization
* */

// --- Diagnostics ---
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
            const playerInput = input.readPlayerFrame()

            diagnostics.frameMs = smooth(diagnostics.frameMs, deltaSeconds * 1000, 0.12)
            diagnostics.fps = smooth(diagnostics.fps, 1 / Math.max(deltaSeconds, 0.0001), 0.12)

            if (debugPanel.isPaused) {
                diagnostics.updateMs = 0
                return
            }

            for (const cue of player.update(safeDeltaSeconds, playerInput)) {
                audio.playTone(cue)
            }

            camera.update(safeDeltaSeconds, player)

            // Sync debug toggles
            debugLayer.showCollision = debugPanel.showCollision
            debugLayer.showLighting = debugPanel.showLighting

            // Update pipeline layers (lighting ray-cast happens here)
            pipeline.update(safeDeltaSeconds)

            diagnostics.rayMs = lightingLayer.lastRayMs
            diagnostics.rays = lightingLayer.lastRays
            diagnostics.rayChecks = lightingLayer.lastRayChecks
            diagnostics.updateMs = performance.now() - updateStart
        },
        render(context) {
            const renderStart = performance.now()
            const cameraRect = camera.getRect()

            context.save()
            context.translate(-cameraRect.x, -cameraRect.y)
            pipeline.render(context, cameraRect)
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
