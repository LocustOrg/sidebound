import { rect, type Rect, type Vec2 } from '../core'
export * from './tilemap'

export type WorldId = string
export type RegionId = string
export type LocationId = string
export type SpawnId = string

export type TilemapChunkSize = readonly [width: number, height: number]

export type ChunkedTilemapDefinition = {
    readonly kind: 'chunked'
    readonly path: string
    readonly chunkSize: TilemapChunkSize
    readonly preloadRadius: number
    readonly unloadRadius: number
    readonly collision?: {
        readonly build?: 'per-chunk' | 'none'
        readonly cache?: boolean
    }
    readonly rendering?: {
        readonly cacheStaticLayers?: boolean
    }
}

export type ConnectionKind = 'edge' | 'door' | 'ladder' | 'portal' | 'fall' | 'debug'
export type EdgeConnectionSide = 'left' | 'right' | 'top' | 'bottom'

export type ConnectionTarget = {
    readonly location: LocationId
    readonly spawn: SpawnId
}

export type LocationConnection = {
    readonly id: string
    readonly kind: ConnectionKind
    readonly to: ConnectionTarget
    readonly edge?: EdgeConnectionSide
    readonly trigger?: Rect
    readonly action?: string
    readonly transition?: string
}

export type LocationDefinition<TId extends LocationId = LocationId> = {
    readonly id: TId
    readonly region: RegionId
    readonly bounds: Rect
    readonly tilemap?: ChunkedTilemapDefinition
    readonly spawnPoints: Readonly<Record<SpawnId, Vec2 | readonly [number, number]>>
    readonly connections?: readonly LocationConnection[]
    readonly entities?: readonly unknown[]
}

export type RegionDefinition<TId extends RegionId = RegionId> = {
    readonly id: TId
    readonly tilesets?: readonly string[]
    readonly defaults?: Readonly<Record<string, unknown>>
    readonly locations: readonly LocationDefinition[]
}

export type WorldDefinition = {
    readonly regions: readonly RegionDefinition[]
    readonly start: ConnectionTarget
}

export function defineWorld<const TDefinition extends WorldDefinition>(definition: TDefinition): TDefinition {
    return definition
}

export function defineRegion<const TDefinition extends RegionDefinition>(definition: TDefinition): TDefinition {
    return definition
}

export function defineLocation<const TDefinition extends LocationDefinition>(definition: TDefinition): TDefinition {
    return definition
}

export function chunkedTilemap(path: string, options: Omit<ChunkedTilemapDefinition, 'kind' | 'path'>): ChunkedTilemapDefinition {
    return {
        kind: 'chunked',
        path,
        ...options,
    }
}

export function connection<const TDefinition extends LocationConnection>(definition: TDefinition): TDefinition {
    return definition
}

export function edgeConnection(side: EdgeConnectionSide, options: Omit<LocationConnection, 'kind' | 'edge'>): LocationConnection {
    return {
        kind: 'edge',
        edge: side,
        ...options,
    }
}

export { rect }

function getSpawnPoint(location: LocationDefinition, spawnId: SpawnId): Vec2 | readonly [number, number] | undefined {
    return location.spawnPoints[spawnId]
}

function pointFromSpawn(spawn: Vec2 | readonly [number, number]): Vec2 {
    if ('x' in spawn) {
        return spawn
    }

    return { x: spawn[0], y: spawn[1] }
}

function pointInsideRect(point: Vec2, bounds: Rect): boolean {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height
}

function rectInsideRect(inner: Rect, outer: Rect): boolean {
    return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height
}

export function validateWorldDefinition(world: WorldDefinition): string[] {
    const errors: string[] = []
    const regionIds = new Set<string>()
    const locations = new Map<string, LocationDefinition>()

    for (const regionDef of world.regions) {
        if (regionIds.has(regionDef.id)) {
            errors.push(`Duplicate region id '${regionDef.id}'`)
        }
        regionIds.add(regionDef.id)

        for (const location of regionDef.locations) {
            if (locations.has(location.id)) {
                errors.push(`Duplicate location id '${location.id}'`)
            }
            if (location.region !== regionDef.id) {
                errors.push(`Location '${location.id}' declares region '${location.region}' but is registered under region '${regionDef.id}'`)
            }

            locations.set(location.id, location)
        }
    }

    const startLocation = locations.get(world.start.location)
    if (!startLocation) {
        errors.push(`World start references unknown location '${world.start.location}'`)
    } else if (!getSpawnPoint(startLocation, world.start.spawn)) {
        errors.push(`World start references unknown spawn '${world.start.spawn}' in location '${world.start.location}'`)
    }

    for (const location of locations.values()) {
        const connectionIds = new Set<string>()

        for (const [spawnId, spawn] of Object.entries(location.spawnPoints)) {
            if (!pointInsideRect(pointFromSpawn(spawn), location.bounds)) {
                errors.push(`Location '${location.id}' spawn '${spawnId}' is outside location bounds`)
            }
        }

        for (const locationConnection of location.connections ?? []) {
            if (connectionIds.has(locationConnection.id)) {
                errors.push(`Location '${location.id}' has duplicate connection id '${locationConnection.id}'`)
            }
            connectionIds.add(locationConnection.id)

            const targetLocation = locations.get(locationConnection.to.location)
            if (!targetLocation) {
                errors.push(`Location '${location.id}' connection '${locationConnection.id}' targets unknown location '${locationConnection.to.location}'`)
            } else if (!getSpawnPoint(targetLocation, locationConnection.to.spawn)) {
                errors.push(
                    `Location '${location.id}' connection '${locationConnection.id}' targets unknown spawn '${locationConnection.to.spawn}' in location '${locationConnection.to.location}'`,
                )
            }

            if (locationConnection.trigger && !rectInsideRect(locationConnection.trigger, location.bounds)) {
                errors.push(`Location '${location.id}' connection '${locationConnection.id}' trigger is outside location bounds`)
            }
        }
    }

    return errors
}

export function assertValidWorldDefinition(world: WorldDefinition): void {
    const errors = validateWorldDefinition(world)

    if (errors.length > 0) {
        throw new Error(`World validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
    }
}
