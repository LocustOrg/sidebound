export type ImageSource = {
    readonly width: number
    readonly height: number
}

export type FillStyle = string | RenderGradient

export interface RenderGradient {
    addColorStop(offset: number, color: string): void
}

export interface RenderContext {
    save(): void
    restore(): void

    translate(x: number, y: number): void
    scale(x: number, y: number): void
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void

    set fillStyle(style: FillStyle)
    set strokeStyle(style: string)
    set globalAlpha(alpha: number)
    set globalCompositeOperation(operation: string)
    set lineWidth(width: number)
    set imageSmoothingEnabled(enabled: boolean)

    fillRect(x: number, y: number, width: number, height: number): void
    strokeRect(x: number, y: number, width: number, height: number): void
    clearRect(x: number, y: number, width: number, height: number): void

    beginPath(): void
    closePath(): void
    moveTo(x: number, y: number): void
    lineTo(x: number, y: number): void
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void
    fill(): void
    stroke(): void

    set font(font: string)
    set textAlign(align: string)
    set textBaseline(baseline: string)
    fillText(text: string, x: number, y: number): void
    strokeText(text: string, x: number, y: number): void

    drawImage(image: ImageSource, dx: number, dy: number): void
    drawImage(image: ImageSource, dx: number, dy: number, dw: number, dh: number): void
    drawImage(image: ImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void

    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): RenderGradient
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): RenderGradient
}

export function toRenderContext(context: CanvasRenderingContext2D): RenderContext {
    return context as unknown as RenderContext
}
