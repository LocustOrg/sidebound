import type { PlacedTile as EnginePlacedTile, TileMapBuildResult } from '@sidebound/engine'

export type TileMaterial = 'wall' | 'glass' | 'decor' | 'grate'
export type PlacedTile = EnginePlacedTile<TileMaterial>
export type Level = TileMapBuildResult<TileMaterial>

export type Viewport = {
    width: number
    height: number
}
