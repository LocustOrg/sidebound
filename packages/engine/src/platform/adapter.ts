/**
 * Platform adapter interface.
 *
 * The engine consumes this interface to stay platform-agnostic. Browser, Deno,
 * and future desktop adapters all implement PlatformAdapter.
 */

import type { ImageSource, RenderContext } from './render-context'

export type PlatformImageAsset = ImageSource & {
    readonly id: string
}

export type OffscreenSurface = {
    readonly context: RenderContext
    readonly width: number
    readonly height: number
    toImageSource(): ImageSource
}

export type PlatformClock = {
    now(): number
    requestFrame(callback: (now: number) => void): number
    cancelFrame(frameId: number): void
}

export type PlatformAdapter = {
    readonly clock: PlatformClock
    loadImage(url: string): Promise<PlatformImageAsset>
    createOffscreenSurface(width: number, height: number): OffscreenSurface
}

