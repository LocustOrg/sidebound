export type Vec2 = {
    x: number
    y: number
}

export type Rect = Vec2 & {
    width: number
    height: number
}

export type Segment = {
    x1: number
    y1: number
    x2: number
    y2: number
}

export type SmoothDampResult = {
    value: number
    velocity: number
}

export function vec2(x: number, y: number): Vec2 {
    return { x, y }
}

export function rect(bounds: readonly [x: number, y: number, width: number, height: number]): Rect {
    return {
        x: bounds[0],
        y: bounds[1],
        width: bounds[2],
        height: bounds[3],
    }
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}

export function approach(current: number, target: number, amount: number): number {
    if (current < target) {
        return Math.min(current + amount, target)
    }

    return Math.max(current - amount, target)
}

export function smooth(current: number, next: number, strength: number): number {
    if (current === 0) {
        return next
    }

    return current + (next - current) * strength
}

export function smoothDamp(current: number, target: number, velocity: number, smoothTime: number, maxSpeed: number, deltaSeconds: number): SmoothDampResult {
    const safeSmoothTime = Math.max(0.0001, smoothTime)
    const omega = 2 / safeSmoothTime
    const x = omega * deltaSeconds
    const exponential = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
    const originalTarget = target
    const maxChange = maxSpeed * safeSmoothTime
    const change = clamp(current - target, -maxChange, maxChange)
    const adjustedTarget = current - change
    const temporaryVelocity = (velocity + omega * change) * deltaSeconds
    let nextVelocity = (velocity - omega * temporaryVelocity) * exponential
    let nextValue = adjustedTarget + (change + temporaryVelocity) * exponential

    if (originalTarget - current > 0 === nextValue > originalTarget) {
        nextValue = originalTarget
        nextVelocity = 0
    }

    return {
        value: nextValue,
        velocity: nextVelocity,
    }
}

export function cross(left: Vec2, right: Vec2): number {
    return left.x * right.y - left.y * right.x
}

export function rectsIntersect(left: Rect, right: Rect): boolean {
    return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}
