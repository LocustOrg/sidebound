import { smooth } from '../core/mod.ts'
import type { RenderFrame } from '../platform/renderer.ts'
import type { RenderLayer } from '../rendering/mod.ts'

export type FrameDiagnostics = {
    fps: number
    frameMs: number
    updateMs: number
    renderMs: number
}

export type DebugFlags = {
    showCollision: boolean
    showLighting: boolean
    noClip: boolean
}

export type DebugOverlayHook = {
    readonly id: string
    readonly order?: number
    render(frame: RenderFrame, flags: DebugFlags): void
}

export function createFrameDiagnostics(): FrameDiagnostics {
    return {
        fps: 0,
        frameMs: 0,
        updateMs: 0,
        renderMs: 0,
    }
}

export function updateFrameDiagnostics(diagnostics: FrameDiagnostics, deltaSeconds: number, strength = 0.12): void {
    diagnostics.frameMs = smooth(diagnostics.frameMs, deltaSeconds * 1000, strength)
    diagnostics.fps = smooth(diagnostics.fps, 1 / Math.max(deltaSeconds, 0.0001), strength)
}

export class DebugOverlayLayer implements RenderLayer {
    readonly order: number
    readonly flags: DebugFlags
    private readonly hooks: DebugOverlayHook[] = []
    private sorted = true

    constructor(options: { readonly order?: number; readonly flags?: Partial<DebugFlags> } = {}) {
        this.order = options.order ?? 100
        this.flags = {
            showCollision: options.flags?.showCollision ?? false,
            showLighting: options.flags?.showLighting ?? false,
            noClip: options.flags?.noClip ?? false,
        }
    }

    addHook(hook: DebugOverlayHook): this {
        this.hooks.push(hook)
        this.sorted = false
        return this
    }

    removeHook(id: string): void {
        const index = this.hooks.findIndex((hook) => hook.id === id)

        if (index !== -1) {
            this.hooks.splice(index, 1)
        }
    }

    render(frame: RenderFrame): void {
        this.ensureSorted()

        for (const hook of this.hooks) {
            hook.render(frame, this.flags)
        }
    }

    private ensureSorted(): void {
        if (this.sorted) {
            return
        }

        this.hooks.sort((left, right) => (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id))
        this.sorted = true
    }
}
