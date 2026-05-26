/**
 * Frame performance tracker for the Sidebound engine.
 * Tracks FPS, frame time, update time, render time, and custom metrics.
 * Designed to be driven externally by the game loop.
 */

import { smooth } from '../core/mod.ts'

export type PerformanceSnapshot = {
    readonly fps: number
    readonly frameTotalMs: number
    readonly updateMs: number
    readonly renderMs: number
    readonly lightingMs: number
    readonly entityCount: number
    readonly layerCount: number
    readonly activeLights: number
    readonly custom: Readonly<Record<string, number>>
}

export class FramePerformanceTracker {
    private _fps = 0
    private _frameTotalMs = 0
    private _updateMs = 0
    private _renderMs = 0
    private _lightingMs = 0
    private _entityCount = 0
    private _layerCount = 0
    private _activeLights = 0
    private readonly customMetrics: Record<string, number> = {}

    private frameStart = 0
    private updateStart = 0
    private renderStart = 0

    private readonly smoothing: number

    constructor(smoothing = 0.1) {
        this.smoothing = smoothing
    }

    /** Call at the very start of a frame */
    beginFrame(): void {
        this.frameStart = performance.now()
    }

    /** Call before the update step */
    beginUpdate(): void {
        this.updateStart = performance.now()
    }

    /** Call after the update step */
    endUpdate(): void {
        const elapsed = performance.now() - this.updateStart
        this._updateMs = smooth(this._updateMs, elapsed, this.smoothing)
    }

    /** Call before the render step */
    beginRender(): void {
        this.renderStart = performance.now()
    }

    /** Call after the render step */
    endRender(): void {
        const elapsed = performance.now() - this.renderStart
        this._renderMs = smooth(this._renderMs, elapsed, this.smoothing)
    }

    /** Call at the very end of a frame with the delta from the game loop */
    endFrame(deltaSeconds: number): void {
        const elapsed = performance.now() - this.frameStart
        this._frameTotalMs = smooth(this._frameTotalMs, elapsed, this.smoothing)
        this._fps = smooth(this._fps, 1 / Math.max(deltaSeconds, 0.0001), this.smoothing)
    }

    /** Update entity/layer info each frame */
    setFrameInfo(info: { entityCount?: number; layerCount?: number; activeLights?: number; lightingMs?: number }): void {
        if (info.entityCount !== undefined) this._entityCount = info.entityCount
        if (info.layerCount !== undefined) this._layerCount = info.layerCount
        if (info.activeLights !== undefined) this._activeLights = info.activeLights
        if (info.lightingMs !== undefined) this._lightingMs = smooth(this._lightingMs, info.lightingMs, this.smoothing)
    }

    /** Set a custom metric */
    setMetric(key: string, value: number): void {
        this.customMetrics[key] = value
    }

    /** Get a full snapshot of current performance data */
    snapshot(): PerformanceSnapshot {
        return {
            fps: Math.round(this._fps),
            frameTotalMs: Math.round(this._frameTotalMs * 100) / 100,
            updateMs: Math.round(this._updateMs * 100) / 100,
            renderMs: Math.round(this._renderMs * 100) / 100,
            lightingMs: Math.round(this._lightingMs * 100) / 100,
            entityCount: this._entityCount,
            layerCount: this._layerCount,
            activeLights: this._activeLights,
            custom: { ...this.customMetrics },
        }
    }

    get fps(): number {
        return Math.round(this._fps)
    }

    get frameTotalMs(): number {
        return this._frameTotalMs
    }
}

