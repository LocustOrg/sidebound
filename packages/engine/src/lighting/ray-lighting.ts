import { clamp, cross, type Rect, type Segment, type Vec2 } from '../core/mod.ts'

export type LightColor = {
    r: number
    g: number
    b: number
}

export type LightSource = {
    getPosition(): Vec2
    getLightRadius(): number
    getLightColor(): LightColor
    getLightIntensity(): number
    isLightActive(): boolean
}

export type RayHit = Vec2 & {
    angle: number
    distance: number
}

export type LightCastResult = {
    polygon: RayHit[]
    rays: number
    rayChecks: number
}

export type PointLightOptions = {
    readonly position: Vec2
    readonly radius: number
    readonly color?: LightColor
    readonly intensity?: number
    readonly active?: boolean
}

export type AttachedLightOptions = Omit<PointLightOptions, 'position'> & {
    readonly positionProvider: () => Vec2
}

const rayAngleOffset = 0.00045
const rayAnglePrecision = 100_000
const radialRaySamples = 128
const fullCircleRadians = Math.PI * 2

function normalizeAngle(angle: number): number {
    return ((angle % fullCircleRadians) + fullCircleRadians) % fullCircleRadians
}

function addRayAngle(angles: number[], angleKeys: Set<number>, angle: number): void {
    const normalizedAngle = normalizeAngle(angle)
    const key = Math.round(normalizedAngle * rayAnglePrecision)

    if (angleKeys.has(key)) {
        return
    }

    angleKeys.add(key)
    angles.push(normalizedAngle)
}

function addEndpointAngles(angles: number[], angleKeys: Set<number>, origin: Vec2, x: number, y: number): void {
    const angle = Math.atan2(y - origin.y, x - origin.x)

    addRayAngle(angles, angleKeys, angle - rayAngleOffset)
    addRayAngle(angles, angleKeys, angle)
    addRayAngle(angles, angleKeys, angle + rayAngleOffset)
}

export function distanceSquaredToSegment(point: Vec2, segment: Segment): number {
    const segmentX = segment.x2 - segment.x1
    const segmentY = segment.y2 - segment.y1
    const lengthSquared = segmentX * segmentX + segmentY * segmentY

    if (lengthSquared === 0) {
        const dx = point.x - segment.x1
        const dy = point.y - segment.y1

        return dx * dx + dy * dy
    }

    const t = clamp(((point.x - segment.x1) * segmentX + (point.y - segment.y1) * segmentY) / lengthSquared, 0, 1)
    const closestX = segment.x1 + t * segmentX
    const closestY = segment.y1 + t * segmentY
    const dx = point.x - closestX
    const dy = point.y - closestY

    return dx * dx + dy * dy
}

export function segmentTouchesCircle(segment: Segment, origin: Vec2, radius: number): boolean {
    return distanceSquaredToSegment(origin, segment) <= radius * radius
}

export function intersectRaySegment(origin: Vec2, angle: number, segment: Segment): RayHit | undefined {
    const rayDirection = {
        x: Math.cos(angle),
        y: Math.sin(angle),
    }
    const segmentDirection = {
        x: segment.x2 - segment.x1,
        y: segment.y2 - segment.y1,
    }
    const denominator = cross(rayDirection, segmentDirection)

    if (Math.abs(denominator) < 0.000001) {
        return undefined
    }

    const originToSegment = {
        x: segment.x1 - origin.x,
        y: segment.y1 - origin.y,
    }
    const rayDistance = cross(originToSegment, segmentDirection) / denominator
    const segmentDistance = cross(originToSegment, rayDirection) / denominator

    if (rayDistance < 0 || segmentDistance < 0 || segmentDistance > 1) {
        return undefined
    }

    return {
        x: origin.x + rayDirection.x * rayDistance,
        y: origin.y + rayDirection.y * rayDistance,
        angle,
        distance: rayDistance,
    }
}

export function buildOccluderSegments(rects: readonly Rect[]): Segment[] {
    return rects.flatMap((rect) => [
        { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y },
        { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height },
        { x1: rect.x + rect.width, y1: rect.y + rect.height, x2: rect.x, y2: rect.y + rect.height },
        { x1: rect.x, y1: rect.y + rect.height, x2: rect.x, y2: rect.y },
    ])
}

export class OccluderSegmentIndex {
    private readonly segments: readonly Segment[]

    constructor(segments: readonly Segment[]) {
        this.segments = segments
    }

    queryCircle(origin: Vec2, radius: number): Segment[] {
        return this.segments.filter((segment) => segmentTouchesCircle(segment, origin, radius))
    }
}

export class RayLighting {
    private readonly occluders: OccluderSegmentIndex

    constructor(solids: readonly Rect[]) {
        this.occluders = new OccluderSegmentIndex(buildOccluderSegments(solids))
    }

    cast(origin: Vec2, radius: number): LightCastResult {
        const activeSegments = this.occluders.queryCircle(origin, radius)
        const angleKeys = new Set<number>()
        const angles: number[] = []

        for (let index = 0; index < radialRaySamples; index += 1) {
            addRayAngle(angles, angleKeys, (index / radialRaySamples) * fullCircleRadians)
        }

        for (const segment of activeSegments) {
            addEndpointAngles(angles, angleKeys, origin, segment.x1, segment.y1)
            addEndpointAngles(angles, angleKeys, origin, segment.x2, segment.y2)
        }

        const hits: RayHit[] = []
        let rayChecks = 0

        for (const angle of angles) {
            let closestHit: RayHit | undefined

            for (const segment of activeSegments) {
                rayChecks += 1
                const hit = intersectRaySegment(origin, angle, segment)

                if (!hit || hit.distance > radius) {
                    continue
                }

                if (!closestHit || hit.distance < closestHit.distance) {
                    closestHit = hit
                }
            }

            if (closestHit) {
                hits.push(closestHit)
            } else {
                hits.push({
                    x: origin.x + Math.cos(angle) * radius,
                    y: origin.y + Math.sin(angle) * radius,
                    angle,
                    distance: radius,
                })
            }
        }

        return {
            polygon: hits.sort((left, right) => left.angle - right.angle),
            rays: angles.length,
            rayChecks,
        }
    }
}

export class PointLight implements LightSource {
    private position: Vec2
    private radius: number
    private color: LightColor
    private intensity: number
    private active: boolean

    constructor(options: PointLightOptions) {
        this.position = { ...options.position }
        this.radius = options.radius
        this.color = options.color ?? { r: 255, g: 240, b: 180 }
        this.intensity = options.intensity ?? 0.9
        this.active = options.active ?? true
    }

    getPosition(): Vec2 {
        return this.position
    }

    getLightRadius(): number {
        return this.radius
    }

    getLightColor(): LightColor {
        return this.color
    }

    getLightIntensity(): number {
        return this.intensity
    }

    isLightActive(): boolean {
        return this.active
    }

    setPosition(position: Vec2): void {
        this.position = position
    }

    setRadius(radius: number): void {
        this.radius = radius
    }

    setColor(color: LightColor): void {
        this.color = color
    }

    setIntensity(intensity: number): void {
        this.intensity = intensity
    }

    setActive(active: boolean): void {
        this.active = active
    }
}

export class AttachedLight implements LightSource {
    private readonly positionProvider: () => Vec2
    private radius: number
    private color: LightColor
    private intensity: number
    private active: boolean

    constructor(options: AttachedLightOptions) {
        this.positionProvider = options.positionProvider
        this.radius = options.radius
        this.color = options.color ?? { r: 200, g: 220, b: 255 }
        this.intensity = options.intensity ?? 0.9
        this.active = options.active ?? true
    }

    getPosition(): Vec2 {
        return this.positionProvider()
    }

    getLightRadius(): number {
        return this.radius
    }

    getLightColor(): LightColor {
        return this.color
    }

    getLightIntensity(): number {
        return this.intensity
    }

    isLightActive(): boolean {
        return this.active
    }

    setRadius(radius: number): void {
        this.radius = radius
    }

    setColor(color: LightColor): void {
        this.color = color
    }

    setIntensity(intensity: number): void {
        this.intensity = intensity
    }

    setActive(active: boolean): void {
        this.active = active
    }
}
