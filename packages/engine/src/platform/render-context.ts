/**
 * Platform-agnostic 2D rendering context.
 *
 * This interface defines the subset of 2D drawing operations the engine needs.
 * Browser adapters implement it via CanvasRenderingContext2D; future Deno/desktop
 * adapters may use WebGPU, SDL, or other backends.
 */

export type ImageSource = {
    readonly width: number
    readonly height: number
}

export type FillStyle = string | RenderGradient

export interface RenderGradient {
    addColorStop(offset: number, color: string): void
}

export interface RenderContext {
    // State
    save(): void
    restore(): void

    // Transform
    translate(x: number, y: number): void
    scale(x: number, y: number): void
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void

    // Style
    set fillStyle(style: FillStyle)
    set strokeStyle(style: string)
    set globalAlpha(alpha: number)
    set globalCompositeOperation(operation: string)
    set lineWidth(width: number)
    set imageSmoothingEnabled(enabled: boolean)

    // Rect operations
    fillRect(x: number, y: number, width: number, height: number): void
    strokeRect(x: number, y: number, width: number, height: number): void
    clearRect(x: number, y: number, width: number, height: number): void

    // Path operations
    beginPath(): void
    closePath(): void
    moveTo(x: number, y: number): void
    lineTo(x: number, y: number): void
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void
    fill(): void
    stroke(): void

    // Text
    set font(font: string)
    set textAlign(align: string)
    set textBaseline(baseline: string)
    fillText(text: string, x: number, y: number): void
    strokeText(text: string, x: number, y: number): void

    // Image drawing
    drawImage(image: ImageSource, dx: number, dy: number): void
    drawImage(image: ImageSource, dx: number, dy: number, dw: number, dh: number): void
    drawImage(image: ImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void

    // Gradient creation
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): RenderGradient
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): RenderGradient
}


