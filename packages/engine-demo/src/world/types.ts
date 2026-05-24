import type { Rect, Vec2 } from '../core/geometry'

export type Level = {
    width: number
    height: number
    spawn: Vec2
    solids: Rect[]
    reflectors: Rect[]
    sunY: number
}

export type TileArea = {
    x: number
    y: number
    width: number
    height: number
}

export type Viewport = {
    width: number
    height: number
}

export type TileKind = 'solid' | 'passable' | 'spawn' | 'decorative'

export type RenderHint = {
    color?: string
    spriteId?: string
    opacity?: number
}

export type PlacementResult = {
    tag: string
    position: Vec2
}

export type TilePlaceContext = {
    x: number
    y: number
    tileSize: number
}

export type TileDefinition = {
    glyph: string
    kind: TileKind
    renderHint?: RenderHint
    onPlace?: (ctx: TilePlaceContext) => PlacementResult | undefined
}

export type LightSource = {
    getPosition(): Vec2
    getLightRadius(): number
    getLightColor(): { r: number; g: number; b: number }
    getLightIntensity(): number
    isLightActive(): boolean
}
