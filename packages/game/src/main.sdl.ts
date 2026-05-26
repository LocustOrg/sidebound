/**
 * SDL3 debug-room entrypoint for Sidebound.
 *
 * Boots the game with terrain, player sprite, items, camera follow,
 * keyboard movement, collision debug boxes, and quit handling.
 * Minimap, DOM debug panel, audio, and full lighting are disabled.
 */

import { type InputEvents, type PlayerInputFrame, reduceInputFrame, RenderPipeline, SideViewCamera } from '@sidebound/engine'
import { createSdlRuntime } from '@sidebound/platform-sdl'
import { loadDemoContent } from './content/load-demo-content.ts'
import { demoContentIds } from './content/mod.ts'
import { ItemFactory } from './content/item-factory.ts'
import { PlayerMob } from './entities/player-mob.ts'
import { BackgroundLayer, DebugLayer, EntityLayer, TerrainLayer } from './rendering/layers/mod.ts'
import { ItemSystem } from './systems/item-system.ts'
import { viewport, world } from './world/demo-map.ts'

const runtime = createSdlRuntime({
    appId: 'sidebound.debug-room',
    window: {
        title: 'Sidebound Debug Room',
        width: viewport.width,
        height: viewport.height,
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
debugLayer.showCollision = true

pipeline.addLayer(backgroundLayer)
pipeline.addLayer(terrainLayer)
pipeline.addLayer(entityLayer)
pipeline.addLayer(debugLayer)

console.log(`[SDL] Debug room started: ${world.width}×${world.height}px, ${world.solids.length} solids`)

await runtime.run({
    update(deltaSeconds: number, input: InputEvents): void {
        const safeDelta = Math.min(deltaSeconds, 0.05)
        const playerInput: PlayerInputFrame = reduceInputFrame(input)

        player.update(safeDelta, playerInput)
        itemSystem.update()
        camera.update(safeDelta, player)
        pipeline.update(safeDelta)
    },

    render(frame): void {
        const cameraRect = camera.getRect()
        pipeline.render({ renderer: frame.renderer, camera: cameraRect })
    },
})

runtime.dispose()
