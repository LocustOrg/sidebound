import type { Rect } from '../core/geometry'

/**
 * A single composable render layer.
 * Layers are drawn in order (lowest `order` first).
 */
export interface RenderLayer {
    readonly order: number
    /** Optional per-layer update (e.g. particles, light cache). Called during the update phase. */
    update?(deltaSeconds: number): void
    /** Draw this layer. Camera rect defines the visible area in world space. */
    render(context: CanvasRenderingContext2D, camera: Rect): void
}

/**
 * Manages an ordered list of render layers and draws them sequentially.
 * Replaces the monolithic DemoRenderer with a composable pipeline.
 */
export class RenderPipeline {
    private layers: RenderLayer[] = []
    private sorted = true

    addLayer(layer: RenderLayer): void {
        this.layers.push(layer)
        this.sorted = false
    }

    removeLayer(layer: RenderLayer): void {
        const index = this.layers.indexOf(layer)
        if (index !== -1) {
            this.layers.splice(index, 1)
        }
    }

    /** Call during the update phase to let layers cache expensive work. */
    update(deltaSeconds: number): void {
        this.ensureSorted()
        for (const layer of this.layers) {
            layer.update?.(deltaSeconds)
        }
    }

    /** Draw all layers in order. Context should already be translated by -camera. */
    render(context: CanvasRenderingContext2D, camera: Rect): void {
        this.ensureSorted()
        for (const layer of this.layers) {
            layer.render(context, camera)
        }
    }

    private ensureSorted(): void {
        if (!this.sorted) {
            this.layers.sort((a, b) => a.order - b.order)
            this.sorted = true
        }
    }
}

