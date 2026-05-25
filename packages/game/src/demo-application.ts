import {
    AttachedLight,
    type Canvas2DPreviewPlatform,
    createFrameDiagnostics,
    type FrameDiagnostics,
    InputManager,
    type KeyboardInputSource,
    LightingLayer,
    PointLight,
    RayLighting,
    type RenderContext,
    type Renderer2D,
    RenderPipeline,
    SideViewCamera,
    updateFrameDiagnostics,
} from '@sidebound/engine'
import { BrowserPlatformAdapter, PixelEngine } from '@sidebound/platform-browser-preview'
import { requireElement } from './core/dom.ts'
import { DebugMinimap } from './debug/debug-minimap.ts'
import { DebugPanel } from './debug/debug-panel.ts'
import { PlayerMob } from './entities/player-mob.ts'
import { BackgroundLayer, DebugLayer, EntityLayer, TerrainLayer } from './rendering/layers/mod.ts'
import { ItemFactory } from './content/item-factory.ts'
import { loadDemoContent, type LoadedDemoContent } from './content/load-demo-content.ts'
import { demoContentIds, type DemoItemId } from './content/mod.ts'
import { DemoAudio } from './systems/audio.ts'
import { ItemSystem } from './systems/item-system.ts'
import { tileSize, viewport, world } from './world/demo-map.ts'

type Diagnostics = FrameDiagnostics & {
    rayMs: number
    rays: number
    rayChecks: number
}

function createKeyboardInputSource(): KeyboardInputSource {
    return {
        addEventListener(type, listener) {
            globalThis.addEventListener(type, listener)
        },
        removeEventListener(type, listener) {
            globalThis.removeEventListener(type, listener)
        },
    }
}

export class DemoApplication {
    private readonly debugPanel: DebugPanel
    private readonly input: InputManager
    private readonly audio: DemoAudio
    private readonly player: PlayerMob
    private readonly itemSystem: ItemSystem
    private readonly camera: SideViewCamera
    private readonly pipeline: RenderPipeline
    private readonly lightingLayer: LightingLayer
    private readonly debugLayer: DebugLayer
    private readonly minimap: DebugMinimap
    private readonly engine: PixelEngine
    private readonly loadedContent: LoadedDemoContent
    private readonly itemFactory: ItemFactory
    private readonly sunLights: PointLight[]
    private readonly playerLight: AttachedLight
    private readonly mapTilesW = Math.round(world.width / tileSize)
    private readonly mapTilesH = Math.round(world.height / tileSize)
    private readonly diagnostics: Diagnostics = {
        ...createFrameDiagnostics(),
        rayMs: 0,
        rays: 0,
        rayChecks: 0,
    }

    static async create(): Promise<DemoApplication> {
        const platform = new BrowserPlatformAdapter()
        console.log(12434234)

        return new DemoApplication(await loadDemoContent(platform), platform)
    }

    private constructor(loadedContent: LoadedDemoContent, platform: Canvas2DPreviewPlatform) {
        const canvas = requireElement<HTMLCanvasElement>('#game')
        const minimapCanvas = requireElement<HTMLCanvasElement>('#debug-minimap')
        const lighting = new RayLighting(world.lightOccluders)

        this.loadedContent = loadedContent
        this.debugPanel = new DebugPanel()
        this.input = new InputManager({
            source: createKeyboardInputSource(),
            blockedBy: {
                contains: (target) => target instanceof Node && this.debugPanel.root.contains(target),
            },
        })
        this.audio = new DemoAudio(this.debugPanel.soundPreferred)
        this.player = new PlayerMob(world.spawn, world.solids, loadedContent.playerAppearance)
        this.itemSystem = new ItemSystem({ equipmentHolder: this.player })
        this.itemFactory = new ItemFactory(loadedContent.registry, loadedContent.itemIconSheets)
        this.camera = new SideViewCamera(world, viewport)
        this.pipeline = new RenderPipeline()
        this.sunLights = DemoApplication.createSunLights()
        this.playerLight = new AttachedLight({
            positionProvider: () => ({ x: this.player.x + this.player.width / 2, y: this.player.y + this.player.height / 2 }),
            radius: 120,
            color: { r: 200, g: 220, b: 255 },
            intensity: 0.85,
        })
        this.lightingLayer = new LightingLayer(lighting, viewport.width, viewport.height, { platform })
        this.debugLayer = new DebugLayer(world.solids)
        this.minimap = new DebugMinimap({
            canvas: minimapCanvas,
            worldWidth: world.width,
            worldHeight: world.height,
            tiles: world.tiles,
            sunLights: this.sunLights.map((sun) => ({ x: sun.getPosition().x, y: sun.getPosition().y, radius: sun.getLightRadius() })),
        })

        this.configureRenderPipeline()
        this.addStarterPickups()
        this.configureDebugPanel()
        this.camera.snapToPlayer(this.player)

        this.engine = new PixelEngine({
            canvas,
            width: viewport.width,
            height: viewport.height,
            scale: 'css',
            background: '#1e1a2e',
            loop: {
                update: (deltaSeconds) => this.update(deltaSeconds),
                render: (context, renderer) => this.render(context, renderer),
            },
        })
    }

    start(): void {
        this.debugPanel.start()
        this.input.start()
        this.logMapInfo()
        this.engine.start()
    }

    private static createSunLights(): PointLight[] {
        const sunLights: PointLight[] = []
        const sunSpacingX = tileSize * 12
        const sunSpacingY = tileSize * 14
        const sunRadius = tileSize * 10

        for (let y = tileSize * 2; y < world.height - tileSize * 4; y += sunSpacingY) {
            for (let x = sunSpacingX; x < world.width - sunSpacingX / 2; x += sunSpacingX) {
                const insideSolid = world.solids.some((solid) => x >= solid.x && x <= solid.x + solid.width && y >= solid.y && y <= solid.y + solid.height)
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

        return sunLights
    }

    private configureRenderPipeline(): void {
        const backgroundLayer = new BackgroundLayer(world)
        const terrainLayer = new TerrainLayer(world)
        const entityLayer = new EntityLayer()

        entityLayer.addMob(this.player)
        entityLayer.setItemProvider(() => this.itemSystem.getItems())
        this.lightingLayer.setCameraProvider(() => this.camera.getRect())
        this.lightingLayer.addLight(this.playerLight)
        for (const sun of this.sunLights) {
            this.lightingLayer.addLight(sun)
        }
        this.debugLayer.setPlayerRectProvider(() => this.player.getRect())
        this.debugLayer.setItemRectProvider(() => this.itemSystem.getDebugRects())
        this.debugLayer.setLightPolygonProvider(() => this.lightingLayer.activeSunData)

        this.pipeline.addLayer(backgroundLayer)
        this.pipeline.addLayer(terrainLayer)
        this.pipeline.addLayer(entityLayer)
        this.pipeline.addLayer(this.lightingLayer)
        this.pipeline.addLayer(this.debugLayer)
    }

    private configureDebugPanel(): void {
        this.debugPanel.setSoundButtonState(this.audio.state)
        this.debugPanel.setSoundToggleHandler(() => this.audio.toggle())
    }

    private addStarterPickups(): void {
        this.addStarterPickup('starter-cape', demoContentIds.redCapeItem, 24)
        this.addStarterPickup('starter-sword', demoContentIds.ironSwordItem, 44)
    }

    private addStarterPickup(id: string, itemId: DemoItemId, offsetX: number): void {
        const item = this.loadedContent.registry.getItem(itemId)
        this.itemSystem.add(
            this.itemFactory.createPickup(
                itemId,
                {
                    x: this.player.x + offsetX,
                    y: this.player.y + this.player.height - item.pickup.size.height,
                },
                id,
            ),
        )
    }

    private update(deltaSeconds: number): void {
        const updateStart = performance.now()
        const safeDeltaSeconds = Math.min(deltaSeconds, 0.05)
        const playerInput = this.input.readPlayerFrame()

        updateFrameDiagnostics(this.diagnostics, deltaSeconds)

        if (this.debugPanel.isPaused) {
            this.diagnostics.updateMs = 0
            return
        }

        for (const cue of this.player.update(safeDeltaSeconds, playerInput)) {
            this.audio.playTone(cue)
        }

        this.itemSystem.update()
        this.camera.update(safeDeltaSeconds, this.player)
        this.debugLayer.showCollision = this.debugPanel.showCollision
        this.debugLayer.showLighting = this.debugPanel.showLighting
        this.player.noClip = this.debugPanel.noClip
        this.pipeline.update(safeDeltaSeconds)

        this.diagnostics.rayMs = this.lightingLayer.lastRayMs
        this.diagnostics.rays = this.lightingLayer.lastRays
        this.diagnostics.rayChecks = this.lightingLayer.lastRayChecks
        this.diagnostics.updateMs = performance.now() - updateStart
    }

    private render(context: RenderContext, renderer: Renderer2D): void {
        const renderStart = performance.now()
        const cameraRect = this.camera.getRect()

        context.save()
        context.translate(-cameraRect.x, -cameraRect.y)
        this.pipeline.render({ context, renderer, camera: cameraRect })
        context.restore()

        this.diagnostics.renderMs = performance.now() - renderStart
        this.debugPanel.updateMetrics({
            ...this.diagnostics,
            grounded: this.player.grounded,
            velocity: {
                x: this.player.vx,
                y: this.player.vy,
            },
            activeSuns: this.lightingLayer.activeSunCount,
            totalSuns: this.lightingLayer.totalSunCount,
            mapSize: `${this.mapTilesW}×${this.mapTilesH}`,
            solids: world.solids.length,
            occluders: world.lightOccluders.length,
        })
        this.minimap.render({ x: this.player.x, y: this.player.y }, cameraRect)
    }

    private logMapInfo(): void {
        console.log(
            `[Content] characters=${this.loadedContent.summary.characters.join(', ')} equipment=${this.loadedContent.summary.equipment.join(', ')} items=${
                this.loadedContent.summary.items.join(', ')
            } atlases=${this.loadedContent.summary.atlases.length}`,
        )
        console.log(
            `[Map] ${this.mapTilesW}×${this.mapTilesH} tiles (${world.width}×${world.height}px), ${world.solids.length} solid rects, ${world.lightOccluders.length} light occluders, ${this.sunLights.length} suns`,
        )
    }
}
