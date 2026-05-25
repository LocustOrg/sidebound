import type { CharacterDefinition, EquipmentDefinition } from '../content/mod.ts'
import { resolveEquipmentLayerOrder } from '../content/mod.ts'
import type { RenderContext } from '../platform/render-context.ts'
import type { SpriteSheet } from './sprite-sheet.ts'

export type EquipmentLoadout = Partial<Record<string, string>>

export type CharacterVisualLayer = {
    readonly id: string
    readonly order: number
    readonly spriteSheet: SpriteSheet
}

export type LoadedEquipmentDefinition = Pick<EquipmentDefinition, 'id' | 'slot'> & {
    readonly visualLayers: readonly CharacterVisualLayer[]
}

export type CharacterAppearance = {
    readonly definition: CharacterDefinition
    readonly base: SpriteSheet
    readonly equipment: Readonly<Record<string, LoadedEquipmentDefinition>>
}

export type CharacterRenderOptions = {
    readonly context: RenderContext
    readonly appearance: CharacterAppearance
    readonly equipment: EquipmentLoadout
    readonly frame: number
    readonly x: number
    readonly y: number
    readonly flipX: boolean
}

const BASE_LAYER_ORDER = 20

export class CharacterRenderer {
    draw(options: CharacterRenderOptions): void {
        const layers = this.collectLayers(options.appearance, options.equipment)

        for (const layer of layers) {
            if (layer.order >= BASE_LAYER_ORDER) continue
            layer.spriteSheet.drawFrame(options.context, options.frame, options.x, options.y, options.flipX)
        }

        options.appearance.base.drawFrame(options.context, options.frame, options.x, options.y, options.flipX)

        for (const layer of layers) {
            if (layer.order < BASE_LAYER_ORDER) continue
            layer.spriteSheet.drawFrame(options.context, options.frame, options.x, options.y, options.flipX)
        }
    }

    private collectLayers(appearance: CharacterAppearance, equipment: EquipmentLoadout): CharacterVisualLayer[] {
        const layers: CharacterVisualLayer[] = []

        for (const equipmentId of Object.values(equipment)) {
            if (!equipmentId) continue

            const definition = appearance.equipment[equipmentId]
            layers.push(...definition.visualLayers)
        }

        layers.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
        return layers
    }
}

export function createLoadedEquipmentDefinition(
    definition: EquipmentDefinition,
    visualLayers: readonly { readonly id: string; readonly order: EquipmentDefinition['layers'][number]['order']; readonly spriteSheet: SpriteSheet }[],
): LoadedEquipmentDefinition {
    return {
        id: definition.id,
        slot: definition.slot,
        visualLayers: visualLayers.map((layer) => ({
            id: layer.id,
            order: resolveEquipmentLayerOrder(layer.order),
            spriteSheet: layer.spriteSheet,
        })),
    }
}
