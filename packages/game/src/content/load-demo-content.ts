import {
    AssetStore,
    createLoadedEquipmentDefinition,
    loadSpriteSheet,
    type CharacterAppearance,
    type ContentRegistry,
    type ItemDefinition,
    type SpriteSheet,
} from '@strange-path/engine'
import { demoContent, demoContentIds } from './index'

export type LoadedDemoContent = {
    readonly registry: ContentRegistry
    readonly playerAppearance: CharacterAppearance
    readonly itemIconSheets: Readonly<Record<string, SpriteSheet>>
    readonly summary: ContentLoadSummary
}

export type ContentLoadSummary = {
    readonly characters: readonly string[]
    readonly equipment: readonly string[]
    readonly items: readonly string[]
    readonly atlases: readonly string[]
}

async function loadCharacterAppearance(registry: ContentRegistry, assets: AssetStore, characterId: string): Promise<CharacterAppearance> {
    const definition = registry.getCharacter(characterId)
    const base = await loadSpriteSheet(assets, definition.atlas, definition.frame.width, definition.frame.height, definition.frame.columns, definition.frame.rows)
    const equipmentEntries = await Promise.all(
        registry.getEquipmentDefinitions().map(async (equipment) => {
            const visualLayers = await Promise.all(
                equipment.layers.map(async (layer) => ({
                    id: layer.id,
                    order: layer.order,
                    spriteSheet: await loadSpriteSheet(assets, layer.atlas, definition.frame.width, definition.frame.height, definition.frame.columns, definition.frame.rows),
                })),
            )

            return [equipment.id, createLoadedEquipmentDefinition(equipment, visualLayers)] as const
        }),
    )

    return {
        definition,
        base,
        equipment: Object.fromEntries(equipmentEntries),
    }
}

async function loadItemIconSheet(assets: AssetStore, item: ItemDefinition): Promise<SpriteSheet> {
    return loadSpriteSheet(assets, item.icon, item.pickup.size.width, item.pickup.size.height, 1, 1)
}

async function loadItemIconSheets(registry: ContentRegistry, assets: AssetStore): Promise<Record<string, SpriteSheet>> {
    const entries = await Promise.all(registry.getItems().map(async (item) => [item.id, await loadItemIconSheet(assets, item)] as const))

    return Object.fromEntries(entries)
}

export async function loadDemoContent(): Promise<LoadedDemoContent> {
    demoContent.assertValid()

    const assets = new AssetStore()
    assets.registerImages(demoContent.getImageAssets())
    await assets.preloadAll()

    const playerDefinition = demoContent.getCharacter(demoContentIds.player)
    const playerAppearance = await loadCharacterAppearance(demoContent, assets, playerDefinition.id)
    const itemIconSheets = await loadItemIconSheets(demoContent, assets)

    return {
        registry: demoContent,
        playerAppearance,
        itemIconSheets,
        summary: {
            characters: demoContent.getCharacters().map((definition) => definition.id),
            equipment: demoContent.getEquipmentDefinitions().map((definition) => definition.id),
            items: demoContent.getItems().map((definition) => definition.id),
            atlases: demoContent.getImageAssets().map((definition) => definition.id),
        },
    }
}
