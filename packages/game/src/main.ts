/**
 * SDL3 debug-room entrypoint for Sidebound.
 *
 * Boots the game with terrain, player sprite, items, camera follow,
 * keyboard movement, collision debug boxes, lighting, and quit handling.
 * Minimap, DOM debug panel, and audio are disabled.
 */

import { AttachedLight, DebugHudLayer, DebugLogger, FramePerformanceTracker, type InputEvents, LightingLayer, LogLevel, type PlayerInputFrame, PointLight, RayLighting, reduceInputFrame, RenderPipeline, SideViewCamera } from '@sidebound/engine'
import { createSdlRuntime } from '@sidebound/platform-sdl'
import { loadDemoContent } from './content/load-demo-content.ts'
import { demoContentIds } from './content/mod.ts'
import { ItemFactory } from './content/item-factory.ts'
import { PlayerMob } from './entities/player-mob.ts'
import { BackgroundLayer, DebugLayer, EntityLayer, TerrainLayer } from './rendering/layers/mod.ts'
import { ItemSystem } from './systems/item-system.ts'
import { tileSize, viewport, world } from './world/demo-map.ts'

const runtime = createSdlRuntime({
    appId: 'sidebound.debug-room',
    window: {
        title: 'Sidebound Debug Room',
        width: viewport.width,
        height: viewport.height,
    },
    presentation: {
        mode: 'letterbox',
    },
    assets: {
        root: new URL('../', import.meta.url),
    },
    clearColor: { r: 30, g: 26, b: 46, a: 1 },
})

// Load content
const loadedContent = await loadDemoContent(runtime.assets, runtime.renderer)

// Player
const player = new PlayerMob(world.spawn, world.solids, loadedContent.playerAppearance)

// Items
const itemSystem = new ItemSystem({ equipmentHolder: player })
const itemFactory = new ItemFactory(loadedContent.registry, loadedContent.itemIconSheets)

function addStarterPickup(id: string, itemId: string, offsetX: number): void {
    const item = loadedContent.registry.getItem(itemId)
    itemSystem.add(
        itemFactory.createPickup(
            itemId,
            {
                x: player.x + offsetX,
                y: player.y + player.height - item.pickup.size.height,
            },
            id,
        ),
    )
}

addStarterPickup('starter-cape', demoContentIds.redCapeItem, 24)
addStarterPickup('starter-sword', demoContentIds.ironSwordItem, 44)

// Camera
const camera = new SideViewCamera(world, viewport)
camera.snapToPlayer(player)

// Lighting
const lighting = new RayLighting(world.lightOccluders)

const sunSpacingX = tileSize * 12
const sunSpacingY = tileSize * 14
const sunRadius = tileSize * 10
const sunLights: PointLight[] = []

for (let y = tileSize * 2; y < world.height - tileSize * 4; y += sunSpacingY) {
    for (let x = sunSpacingX; x < world.width - sunSpacingX / 2; x += sunSpacingX) {
        const insideSolid = world.solids.some(
            (solid) => x >= solid.x && x <= solid.x + solid.width && y >= solid.y && y <= solid.y + solid.height,
        )
        if (insideSolid) continue

        sunLights.push(
            new PointLight({
                position: { x, y },
                radius: sunRadius,
                color: { r: 255, g: 240, b: 180 },
                intensity: 0.9,
            }),
        )
    }
}

const playerLight = new AttachedLight({
    positionProvider: () => ({ x: player.x + player.width / 2, y: player.y + player.height / 2 }),
    radius: 120,
    color: { r: 200, g: 220, b: 255 },
    intensity: 0.85,
})

const lightingLayer = new LightingLayer(lighting, viewport.width, viewport.height, {})
lightingLayer.setCameraProvider(() => camera.getRect())
lightingLayer.addLight(playerLight)
for (const sun of sunLights) {
    lightingLayer.addLight(sun)
}

// Render pipeline
const pipeline = new RenderPipeline()
const backgroundLayer = new BackgroundLayer(world)
const terrainLayer = new TerrainLayer(world)
const entityLayer = new EntityLayer()
const debugLayer = new DebugLayer(world.solids)

entityLayer.addMob(player)
entityLayer.setItemProvider(() => itemSystem.getItems())
debugLayer.setPlayerRectProvider(() => player.getRect())
debugLayer.setItemRectProvider(() => itemSystem.getDebugRects())
debugLayer.setLightPolygonProvider(() => lightingLayer.activeSunData)
debugLayer.showCollision = true

// Debug tooling
const logger = new DebugLogger({ level: LogLevel.Debug, prefix: '[Game]' })
const perf = new FramePerformanceTracker(0.08)
const debugHud = new DebugHudLayer({ enabled: true, position: 'top-left' })
debugHud.setPerformanceProvider(() => perf.snapshot())
debugHud.addPanel({
    id: 'player',
    getLines() {
        return [
            `Pos: ${Math.round(player.x)},${Math.round(player.y)}`,
            `Vel: ${player.vx.toFixed(0)},${player.vy.toFixed(0)}`,
            `State: ${player.mobState}`,
            `Grounded: ${player.grounded}`,
        ]
    },
})

pipeline.addLayer(backgroundLayer)
pipeline.addLayer(terrainLayer)
pipeline.addLayer(entityLayer)
pipeline.addLayer(lightingLayer)
pipeline.addLayer(debugLayer)
pipeline.addLayer(debugHud)

console.log(`[SDL] Debug room started: ${world.width}×${world.height}px, ${world.solids.length} solids, ${sunLights.length} suns`)
logger.info('init', `World: ${world.width}×${world.height}, spawn: (${Math.round(world.spawn.x)}, ${Math.round(world.spawn.y)})`)
logger.info('init', `Pipeline: ${pipeline.getLayers().length} layers`)

let debugToggleCooldown = 0
let diagPrintTimer = 0
const DIAG_PRINT_INTERVAL = 3.0 // seconds

await runtime.run({
    update(deltaSeconds: number, input: InputEvents): void {
        perf.beginFrame()
        perf.beginUpdate()
        logger.tick()

        const safeDelta = Math.min(deltaSeconds, 0.05)
        const playerInput: PlayerInputFrame = reduceInputFrame(input)

        // Toggle debug HUD with F3
        debugToggleCooldown -= safeDelta
        if (input.keysDown.some((k) => k === 'f3') && debugToggleCooldown <= 0) {
            debugHud.enabled = !debugHud.enabled
            debugLayer.showCollision = debugHud.enabled
            logger.info('debug', `Debug HUD ${debugHud.enabled ? 'enabled' : 'disabled'}`)
            debugToggleCooldown = 0.3
        }

        // Toggle lighting debug with F4
        if (input.keysDown.some((k) => k === 'f4') && debugToggleCooldown <= 0) {
            debugLayer.showLighting = !debugLayer.showLighting
            logger.info('debug', `Lighting debug ${debugLayer.showLighting ? 'enabled' : 'disabled'}`)
            debugToggleCooldown = 0.3
        }

        // Toggle noclip with F5
        if (input.keysDown.some((k) => k === 'f5') && debugToggleCooldown <= 0) {
            player.noClip = !player.noClip
            logger.info('debug', `NoClip ${player.noClip ? 'enabled' : 'disabled'}`)
            debugToggleCooldown = 0.3
        }

        if (input.windowResized) {
            logger.info('window', `Resized window to ${input.windowResized.width}×${input.windowResized.height}; logical viewport remains ${viewport.width}×${viewport.height}`)
        }

        player.update(safeDelta, playerInput)
        itemSystem.update()
        camera.update(safeDelta, player)
        pipeline.update(safeDelta)

        perf.endUpdate()
        perf.setFrameInfo({
            entityCount: 1 + itemSystem.getItems().length,
            layerCount: pipeline.getLayers().length,
            activeLights: lightingLayer.activeSunCount,
            lightingMs: lightingLayer.lastRayMs,
        })
        perf.endFrame(safeDelta)

        // Periodic diagnostics console print
        diagPrintTimer += safeDelta
        if (diagPrintTimer >= DIAG_PRINT_INTERVAL) {
            diagPrintTimer = 0
            const snap = perf.snapshot()
            logger.debug('perf', `FPS:${snap.fps} Frame:${snap.frameTotalMs.toFixed(1)}ms Update:${snap.updateMs.toFixed(1)}ms Render:${snap.renderMs.toFixed(1)}ms Lights:${snap.activeLights}/${lightingLayer.totalSunCount} Entities:${snap.entityCount}`)
        }
    },

    render(frame): void {
        perf.beginRender()
        const cameraRect = camera.getRect()
        pipeline.render({ renderer: frame.renderer, camera: cameraRect })
        perf.endRender()
    },
})

runtime.dispose()
