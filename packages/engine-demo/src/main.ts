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
import { ItemSystem } from './systems/item-system'
import { RenderPipeline } from './rendering/pipeline'
import { BackgroundLayer } from './rendering/layers'
import { TerrainLayer } from './rendering/layers'
import { EntityLayer } from './rendering/layers'
import { LightingLayer, type SunLight } from './rendering/layers/lighting'
import { DebugLayer } from './rendering/layers'
import { DebugMinimap } from './debug/debug-minimap'
import { createCapeItemSpriteSheet, createSwordItemSpriteSheet } from './sprites/item-sprites'
import './style.css'

const canvas = requireElement<HTMLCanvasElement>('#game')
const debugPanel = new DebugPanel()
const input = new GameInput(debugPanel.root)
const audio = new DemoAudio(debugPanel.soundPreferred)
const player = new PlayerMob(world.spawn, world.solids)
const itemSystem = new ItemSystem({ player })
const camera = new SideViewCamera(world, viewport)

const allOccluders = [...world.solids, ...world.reflectors]
const lighting = new RayLighting(allOccluders)

const sunLights: SunLight[] = []
const sunSpacingX = tileSize * 12
const sunSpacingY = tileSize * 14
const sunRadius = tileSize * 10
for (let y = tileSize * 2; y < world.height - tileSize * 4; y += sunSpacingY) {
    for (let x = sunSpacingX; x < world.width - sunSpacingX / 2; x += sunSpacingX) {
        sunLights.push({ x, y, radius: sunRadius })
    }
}

const pipeline = new RenderPipeline()

const backgroundLayer = new BackgroundLayer(world)
backgroundLayer.setSunLights(sunLights)
const terrainLayer = new TerrainLayer(world)
const entityLayer = new EntityLayer()
const lightingLayer = new LightingLayer(lighting, viewport.width, viewport.height)
const debugLayer = new DebugLayer(world.solids)

entityLayer.addMob(player)

lightingLayer.setSunLights(sunLights)
lightingLayer.setCameraProvider(() => camera.getRect())

itemSystem.add({
    id: 'starter-cape',
    kind: 'cape',
    x: player.x + 24,
    y: player.y + player.height - 16,
    width: 16,
    height: 16,
    spriteSheet: createCapeItemSpriteSheet(),
    effect: { type: 'equip', equipment: 'cape' },
})
itemSystem.add({
    id: 'starter-sword',
    kind: 'sword',
    x: player.x + 44,
    y: player.y + player.height - 16,
    width: 16,
    height: 16,
    spriteSheet: createSwordItemSpriteSheet(),
    effect: { type: 'equip', equipment: 'sword' },
})

debugLayer.setPlayerRectProvider(() => player.getRect())
debugLayer.setItemRectProvider(() => itemSystem.getDebugRects())
debugLayer.setLightPolygonProvider(() => lightingLayer.activeSunData)
entityLayer.setItemProvider(() => itemSystem.getItems())

pipeline.addLayer(backgroundLayer)
pipeline.addLayer(terrainLayer)
pipeline.addLayer(entityLayer)
pipeline.addLayer(lightingLayer)
pipeline.addLayer(debugLayer)

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

const minimapCanvas = requireElement<HTMLCanvasElement>('#debug-minimap')
const minimap = new DebugMinimap({
    canvas: minimapCanvas,
    worldWidth: world.width,
    worldHeight: world.height,
    solids: world.solids,
    reflectors: world.reflectors,
    sunLights,
})

const mapTilesW = Math.round(world.width / tileSize)
const mapTilesH = Math.round(world.height / tileSize)
console.log(
    `[Map] ${mapTilesW}×${mapTilesH} tiles (${world.width}×${world.height}px), ${world.solids.length} solids, ${world.reflectors.length} reflectors, ${sunLights.length} suns`,
)

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

            itemSystem.update()
            camera.update(safeDeltaSeconds, player)

            debugLayer.showCollision = debugPanel.showCollision
            debugLayer.showLighting = debugPanel.showLighting
            player.noClip = debugPanel.noClip

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

            minimap.render({ x: player.x, y: player.y }, cameraRect)
        },
    },
})

engine.start()
