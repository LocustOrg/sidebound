import { PixelEngine } from '@strange-path/engine'
import { DemoAudio } from './systems/audio'
import { SideViewCamera } from './systems/camera'
import { DebugPanel } from './debug/debug-panel'
import { tileSize, viewport, world } from './world/demo-map'
import { requireElement } from './core/dom'
import { smooth } from './core/geometry'
import { GameInput } from './systems/input'
import { RayLighting } from './systems/lighting'
import { PlayerMob } from './entities/player-mob'
import { RenderPipeline } from './rendering/pipeline'
import { BackgroundLayer } from './rendering/layers/background'
import { TerrainLayer } from './rendering/layers/terrain'
import { EntityLayer } from './rendering/layers/entity'
import { LightingLayer, type SunLight } from './rendering/layers/lighting'
import { DebugLayer } from './rendering/layers/debug'
import { DebugMinimap } from './debug/debug-minimap'
import './style.css'

const canvas = requireElement<HTMLCanvasElement>('#game')
const debugPanel = new DebugPanel()
const input = new GameInput(debugPanel.root)
const audio = new DemoAudio(debugPanel.soundPreferred)
const player = new PlayerMob(world.spawn, world.solids, world.width, world.height)
const camera = new SideViewCamera(world, viewport)

// Lighting uses both solids and reflectors as occluders for ray-casting
const allOccluders = [...world.solids, ...world.reflectors]
const lighting = new RayLighting(allOccluders)

// --- Generate sun lights distributed across the map ---
// Suns are placed in a grid: horizontally every 16 tiles, vertically every 20 tiles
const sunLights: SunLight[] = []
const sunSpacingX = tileSize * 16
const sunSpacingY = tileSize * 20
const sunRadius = tileSize * 12
for (let y = tileSize * 2; y < world.height - tileSize * 4; y += sunSpacingY) {
    for (let x = sunSpacingX; x < world.width - sunSpacingX / 2; x += sunSpacingX) {
        sunLights.push({ x, y, radius: sunRadius })
    }
}

// --- Layered Render Pipeline ---
const pipeline = new RenderPipeline()

const backgroundLayer = new BackgroundLayer(world)
backgroundLayer.setSunLights(sunLights)
const terrainLayer = new TerrainLayer(world)
const entityLayer = new EntityLayer()
const lightingLayer = new LightingLayer(lighting, viewport.width, viewport.height)
const debugLayer = new DebugLayer(world.solids)

entityLayer.addMob(player)

// Configure sun-based lighting (no player light)
lightingLayer.setSunLights(sunLights)
lightingLayer.setCameraProvider(() => camera.getRect())

debugLayer.setPlayerRectProvider(() => player.getRect())
debugLayer.setLightPolygonProvider(() => lightingLayer.activeSunData)

pipeline.addLayer(backgroundLayer)
pipeline.addLayer(terrainLayer)
pipeline.addLayer(entityLayer)
pipeline.addLayer(lightingLayer)
pipeline.addLayer(debugLayer)

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

// --- Debug Minimap ---
const minimapCanvas = requireElement<HTMLCanvasElement>('#debug-minimap')
const minimap = new DebugMinimap({
    canvas: minimapCanvas,
    worldWidth: world.width,
    worldHeight: world.height,
    solids: world.solids,
    reflectors: world.reflectors,
    sunLights,
})

// Log map info
const mapTilesW = Math.round(world.width / tileSize)
const mapTilesH = Math.round(world.height / tileSize)
console.log(`[Map] ${mapTilesW}×${mapTilesH} tiles (${world.width}×${world.height}px), ${world.solids.length} solids, ${world.reflectors.length} reflectors, ${sunLights.length} suns`)

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
            player.noClip = debugPanel.noClip

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
                activeSuns: lightingLayer.activeSunCount,
                totalSuns: lightingLayer.totalSunCount,
                mapSize: `${mapTilesW}×${mapTilesH}`,
                solids: world.solids.length,
                reflectors: world.reflectors.length,
            })

            // Update minimap
            minimap.render(
                { x: player.x, y: player.y },
                cameraRect,
            )
        },
    },
})

engine.start()
