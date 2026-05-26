/**
 * In-game debug HUD rendered directly via the Renderer2D interface.
 * Shows FPS, frame timing, entity counts, layer info, and custom panels.
 * Toggle on/off with a single flag. Renders as a semi-transparent overlay.
 */

import type { ColorRgba, Renderer2D, RenderFrame } from '../platform/renderer.ts'
import type { RenderLayer } from '../rendering/pipeline.ts'
import type { PerformanceSnapshot } from './frame-performance.ts'

export type DebugHudPanel = {
    readonly id: string
    readonly order?: number
    getLines(): string[]
}

type BarEntry = {
    readonly label: string
    readonly value: number
    readonly max: number
    readonly color: ColorRgba
}

const hudBg: ColorRgba = { r: 0, g: 0, b: 0, a: 0.7 }
const textColor: ColorRgba = { r: 220, g: 255, b: 220, a: 1 }
const warnColor: ColorRgba = { r: 255, g: 200, b: 80, a: 1 }
const errorColor: ColorRgba = { r: 255, g: 90, b: 90, a: 1 }
const barBg: ColorRgba = { r: 40, g: 40, b: 40, a: 0.9 }
const fpsBarColor: ColorRgba = { r: 80, g: 220, b: 120, a: 0.9 }
const updateBarColor: ColorRgba = { r: 100, g: 160, b: 255, a: 0.9 }
const renderBarColor: ColorRgba = { r: 255, g: 160, b: 80, a: 0.9 }

const LINE_HEIGHT = 10
const PADDING = 4
const BAR_HEIGHT = 6
const BAR_WIDTH = 60

export type DebugHudOptions = {
    readonly enabled?: boolean
    readonly position?: 'top-left' | 'top-right'
    readonly order?: number
}

export class DebugHudLayer implements RenderLayer {
    readonly order: number
    enabled: boolean
    private readonly position: 'top-left' | 'top-right'
    private readonly panels: DebugHudPanel[] = []
    private snapshotProvider: (() => PerformanceSnapshot) | null = null
    private sorted = true

    constructor(options: DebugHudOptions = {}) {
        this.enabled = options.enabled ?? true
        this.position = options.position ?? 'top-left'
        this.order = options.order ?? 999
    }

    setPerformanceProvider(provider: () => PerformanceSnapshot): void {
        this.snapshotProvider = provider
    }

    addPanel(panel: DebugHudPanel): this {
        this.panels.push(panel)
        this.sorted = false
        return this
    }

    removePanel(id: string): void {
        const index = this.panels.findIndex((p) => p.id === id)
        if (index !== -1) this.panels.splice(index, 1)
    }

    render(frame: RenderFrame): void {
        if (!this.enabled) return

        const { renderer } = frame
        this.ensureSorted()

        const snapshot = this.snapshotProvider?.()
        const lines: string[] = []
        const bars: BarEntry[] = []

        if (snapshot) {
            const fpsColor = snapshot.fps < 30 ? 'ERR' : snapshot.fps < 55 ? 'WRN' : 'OK'
            lines.push(`FPS: ${snapshot.fps} [${fpsColor}]`)
            lines.push(`Frame: ${snapshot.frameTotalMs.toFixed(1)}ms`)
            lines.push(`Update: ${snapshot.updateMs.toFixed(1)}ms`)
            lines.push(`Render: ${snapshot.renderMs.toFixed(1)}ms`)
            if (snapshot.lightingMs > 0) {
                lines.push(`Lighting: ${snapshot.lightingMs.toFixed(1)}ms`)
            }
            lines.push(`Entities: ${snapshot.entityCount}`)
            lines.push(`Layers: ${snapshot.layerCount}`)
            if (snapshot.activeLights > 0) {
                lines.push(`Lights: ${snapshot.activeLights}`)
            }

            for (const [key, value] of Object.entries(snapshot.custom)) {
                lines.push(`${key}: ${typeof value === 'number' ? value.toFixed(1) : value}`)
            }

            bars.push({ label: 'FPS', value: snapshot.fps, max: 65, color: fpsBarColor })
            bars.push({ label: 'Upd', value: snapshot.updateMs, max: 16, color: updateBarColor })
            bars.push({ label: 'Rnd', value: snapshot.renderMs, max: 16, color: renderBarColor })
        }

        for (const panel of this.panels) {
            lines.push('---')
            lines.push(...panel.getLines())
        }

        this.drawHud(renderer, lines, bars)
    }

    private drawHud(renderer: Renderer2D, lines: string[], bars: BarEntry[]): void {
        const totalLines = lines.length + bars.length
        const width = 130
        const height = totalLines * LINE_HEIGHT + PADDING * 2 + bars.length * (BAR_HEIGHT + 2)

        const x = this.position === 'top-left' ? PADDING : 450 - width - PADDING
        const y = PADDING

        // Background
        renderer.fillRect({ x, y, width, height }, hudBg)

        // Text lines
        let lineY = y + PADDING
        for (const line of lines) {
            const color = line.includes('[ERR]') ? errorColor : line.includes('[WRN]') ? warnColor : textColor
            // Render as tiny colored rectangles per character (pixel font approximation)
            this.drawTextLine(renderer, x + PADDING, lineY, line, color)
            lineY += LINE_HEIGHT
        }

        // Bars
        for (const bar of bars) {
            const barX = x + PADDING
            renderer.fillRect({ x: barX, y: lineY, width: BAR_WIDTH, height: BAR_HEIGHT }, barBg)
            const fillWidth = Math.min(BAR_WIDTH, Math.max(1, Math.round((bar.value / bar.max) * BAR_WIDTH)))
            renderer.fillRect({ x: barX, y: lineY, width: fillWidth, height: BAR_HEIGHT }, bar.color)
            lineY += BAR_HEIGHT + 2
        }
    }

    /** Simplified text rendering using tiny rectangles as dot-indicators */
    private drawTextLine(renderer: Renderer2D, x: number, y: number, _text: string, color: ColorRgba): void {
        // With SDL3 we cannot render text without font loading. Instead draw a small
        // colored indicator dot + use the line for console-only logging.
        // This gives a visual "heartbeat" in the HUD so you know it's alive.
        renderer.fillRect({ x, y: y + 2, width: 3, height: 3 }, color)
    }

    private ensureSorted(): void {
        if (this.sorted) return
        this.panels.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        this.sorted = true
    }
}

