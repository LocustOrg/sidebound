import type { TileDefinition, TileKind, RenderHint, TilePlaceContext, PlacementResult } from './types'

export class TileRegistry {
    private readonly tiles = new Map<string, TileDefinition>()

    constructor() {
        this.register({ glyph: '.', kind: 'decorative' })
        this.register({ glyph: ' ', kind: 'decorative' })
        this.register({ glyph: '~', kind: 'decorative' })
    }

    register(definition: TileDefinition): this {
        if (definition.glyph.length !== 1) {
            throw new Error(`Glyph must be a single character, got "${definition.glyph}"`)
        }
        this.tiles.set(definition.glyph, definition)
        return this
    }

    get(glyph: string): TileDefinition | undefined {
        return this.tiles.get(glyph)
    }

    has(glyph: string): boolean {
        return this.tiles.has(glyph)
    }

    getKind(glyph: string): TileKind | undefined {
        return this.tiles.get(glyph)?.kind
    }

    getRenderHint(glyph: string): RenderHint | undefined {
        return this.tiles.get(glyph)?.renderHint
    }

    place(glyph: string, ctx: TilePlaceContext): PlacementResult | undefined {
        const def = this.tiles.get(glyph)
        if (!def?.onPlace) return undefined
        return def.onPlace(ctx)
    }

    glyphs(): string[] {
        return [...this.tiles.keys()]
    }
}
