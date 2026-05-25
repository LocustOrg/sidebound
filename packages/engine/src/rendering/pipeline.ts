import type { Canvas2DPreviewRenderFrame } from '../platform/renderer.ts'

export interface RenderLayer {
    readonly order: number
    update?(deltaSeconds: number): void
    render(frame: Canvas2DPreviewRenderFrame): void
}

export class RenderPipeline {
    private readonly layers: RenderLayer[] = []
    private sorted = true

    addLayer(layer: RenderLayer): this {
        this.layers.push(layer)
        this.sorted = false
        return this
    }

    removeLayer(layer: RenderLayer): void {
        const index = this.layers.indexOf(layer)

        if (index !== -1) {
            this.layers.splice(index, 1)
        }
    }

    clear(): void {
        this.layers.length = 0
        this.sorted = true
    }

    getLayers(): readonly RenderLayer[] {
        this.ensureSorted()
        return this.layers
    }

    update(deltaSeconds: number): void {
        this.ensureSorted()

        for (const layer of this.layers) {
            layer.update?.(deltaSeconds)
        }
    }

    render(frame: Canvas2DPreviewRenderFrame): void {
        this.ensureSorted()

        for (const layer of this.layers) {
            layer.render(frame)
        }
    }

    private ensureSorted(): void {
        if (this.sorted) {
            return
        }

        this.layers.sort((left, right) => left.order - right.order)
        this.sorted = true
    }
}
