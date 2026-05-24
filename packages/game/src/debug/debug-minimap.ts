import type { Rect, SunLight, Vec2 } from '@strange-path/engine'

export type MinimapConfig = {
    canvas: HTMLCanvasElement
    worldWidth: number
    worldHeight: number
    solids: Rect[]
    reflectors: Rect[]
    sunLights: SunLight[]
}

/**
 * Renders a minimap overview of the game world inside the debug panel.
 * Shows solids, reflectors, sun positions, player position, and camera viewport.
 */
export class DebugMinimap {
    private readonly canvas: HTMLCanvasElement
    private readonly ctx: CanvasRenderingContext2D
    private readonly worldWidth: number
    private readonly worldHeight: number
    private readonly solids: Rect[]
    private readonly reflectors: Rect[]
    private readonly sunLights: SunLight[]
    private readonly scaleX: number
    private readonly scaleY: number

    // Static map is pre-rendered to an offscreen canvas
    private readonly staticMap: HTMLCanvasElement

    constructor(config: MinimapConfig) {
        this.canvas = config.canvas
        this.ctx = this.canvas.getContext('2d')!
        this.worldWidth = config.worldWidth
        this.worldHeight = config.worldHeight
        this.solids = config.solids
        this.reflectors = config.reflectors
        this.sunLights = config.sunLights

        this.scaleX = this.canvas.width / this.worldWidth
        this.scaleY = this.canvas.height / this.worldHeight

        // Pre-render static elements (solids, reflectors, suns) once
        this.staticMap = document.createElement('canvas')
        this.staticMap.width = this.canvas.width
        this.staticMap.height = this.canvas.height
        this.renderStaticMap()
    }

    private renderStaticMap(): void {
        const ctx = this.staticMap.getContext('2d')!
        const { scaleX, scaleY } = this

        // Background
        ctx.fillStyle = '#1a1628'
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

        // Solids
        ctx.fillStyle = '#5e5478'
        for (const s of this.solids) {
            ctx.fillRect(Math.floor(s.x * scaleX), Math.floor(s.y * scaleY), Math.max(1, Math.ceil(s.width * scaleX)), Math.max(1, Math.ceil(s.height * scaleY)))
        }

        // Reflectors
        ctx.fillStyle = '#4ea8cc'
        for (const r of this.reflectors) {
            ctx.fillRect(Math.floor(r.x * scaleX), Math.floor(r.y * scaleY), Math.max(1, Math.ceil(r.width * scaleX)), Math.max(1, Math.ceil(r.height * scaleY)))
        }

        // Sun positions (small dots)
        ctx.fillStyle = '#f4c45f'
        for (const sun of this.sunLights) {
            const sx = Math.floor(sun.x * scaleX)
            const sy = Math.floor(sun.y * scaleY)
            ctx.fillRect(sx - 1, sy - 1, 3, 3)
        }
    }

    /**
     * Draws the minimap with dynamic overlays (player + camera viewport).
     * Call this each frame (or throttled).
     */
    render(playerPos: Vec2, cameraRect: Rect): void {
        const { ctx, scaleX, scaleY } = this

        // Blit the pre-rendered static map
        ctx.drawImage(this.staticMap, 0, 0)

        // Camera viewport rectangle
        const cx = Math.floor(cameraRect.x * scaleX)
        const cy = Math.floor(cameraRect.y * scaleY)
        const cw = Math.max(1, Math.ceil(cameraRect.width * scaleX))
        const ch = Math.max(1, Math.ceil(cameraRect.height * scaleY))
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.lineWidth = 1
        ctx.strokeRect(cx + 0.5, cy + 0.5, cw, ch)

        // Player position (bright green dot)
        const px = Math.floor(playerPos.x * scaleX)
        const py = Math.floor(playerPos.y * scaleY)
        ctx.fillStyle = '#73ff99'
        ctx.fillRect(px - 1, py - 1, 3, 3)
    }
}
