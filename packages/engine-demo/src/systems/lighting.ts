import { clamp, cross, type Rect, type Segment, type Vec2 } from '../core/geometry'

export type RayHit = Vec2 & {
    angle: number
    distance: number
}

export type LightCastResult = {
    polygon: RayHit[]
    rays: number
    rayChecks: number
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

function distanceSquaredToSegment(point: Vec2, segment: Segment): number {
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

function segmentTouchesCircle(segment: Segment, origin: Vec2, radius: number): boolean {
    return distanceSquaredToSegment(origin, segment) <= radius * radius
}

function intersectRaySegment(origin: Vec2, angle: number, segment: Segment): RayHit | undefined {
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

function buildSegments(rects: Rect[]): Segment[] {
    return rects.flatMap((rect) => [
        { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y },
        { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height },
        { x1: rect.x + rect.width, y1: rect.y + rect.height, x2: rect.x, y2: rect.y + rect.height },
        { x1: rect.x, y1: rect.y + rect.height, x2: rect.x, y2: rect.y },
    ])
}

export class RayLighting {
    private readonly occluderSegments: Segment[]

    constructor(solids: Rect[]) {
        this.occluderSegments = buildSegments(solids)
    }

    cast(origin: Vec2, radius: number): LightCastResult {
        const activeSegments = this.occluderSegments.filter((segment) => segmentTouchesCircle(segment, origin, radius))
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
