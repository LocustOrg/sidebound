import type { AssetId, ImageAssetDefinition } from '../assets'
import type { SpriteClipDefinition } from '../sprites'

export type ContentId = string

export type Size = {
    readonly width: number
    readonly height: number
}

export type Vec2Like = {
    readonly x: number
    readonly y: number
}

export type FrameGridDefinition = Size & {
    readonly columns: number
    readonly rows: number
}

export type FrameSocketDefinition = {
    readonly x: number
    readonly y: number
    readonly angle?: number
}

export type CharacterFrameMetadataDefinition = {
    readonly frame: number
    readonly sockets?: Readonly<Record<string, FrameSocketDefinition>>
}

export type CharacterDefinition<TId extends ContentId = ContentId> = {
    readonly id: TId
    readonly atlas: AssetId
    readonly frame: FrameGridDefinition
    readonly hitbox: Size
    readonly spriteOffset: Vec2Like
    readonly clips: Readonly<Record<string, SpriteClipDefinition>>
    readonly frameMetadata?: Readonly<Record<number, CharacterFrameMetadataDefinition>>
}

export type EquipmentLayerOrder = 'behindBody' | 'heldItem' | 'frontAccessory' | number

export type EquipmentLayerDefinition = {
    readonly id: ContentId
    readonly atlas: AssetId
    readonly order: EquipmentLayerOrder
    readonly align: 'characterFrame'
}

export type EquipmentDefinition<TId extends ContentId = ContentId, TSlot extends ContentId = ContentId> = {
    readonly id: TId
    readonly slot: TSlot
    readonly layers: readonly EquipmentLayerDefinition[]
}

export type ItemEffectDefinition = {
    readonly type: 'equip'
    readonly equipment: ContentId
}

export type ItemDefinition<TId extends ContentId = ContentId> = {
    readonly id: TId
    readonly icon: AssetId
    readonly pickup: {
        readonly size: Size
    }
    readonly effects: readonly ItemEffectDefinition[]
}

export function defineCharacter<const TDefinition extends CharacterDefinition>(definition: TDefinition): TDefinition {
    return definition
}

export function defineEquipment<const TDefinition extends EquipmentDefinition>(definition: TDefinition): TDefinition {
    return definition
}

export function defineItem<const TDefinition extends ItemDefinition>(definition: TDefinition): TDefinition {
    return definition
}

function registerUnique<TValue>(map: Map<string, TValue>, id: string, value: TValue, label: string): void {
    if (map.has(id)) {
        throw new Error(`Duplicate ${label} id '${id}'`)
    }

    map.set(id, value)
}

function getRequired<TValue>(map: Map<string, TValue>, id: string, label: string): TValue {
    const value = map.get(id)

    if (!value) {
        throw new Error(`Unknown ${label} '${id}'`)
    }

    return value
}

function validateAssetReference(assets: Map<AssetId, ImageAssetDefinition>, assetId: AssetId, label: string, errors: string[]): void {
    if (!assets.has(assetId)) {
        errors.push(`${label} references unknown image asset '${assetId}'`)
    }
}

function validateSize(size: Size, label: string, errors: string[]): void {
    if (!Number.isInteger(size.width) || size.width <= 0) {
        errors.push(`${label} width must be a positive integer`)
    }
    if (!Number.isInteger(size.height) || size.height <= 0) {
        errors.push(`${label} height must be a positive integer`)
    }
}

function validateGrid(grid: FrameGridDefinition, label: string, errors: string[]): void {
    validateSize(grid, label, errors)
    if (!Number.isInteger(grid.columns) || grid.columns <= 0) {
        errors.push(`${label} frame columns must be a positive integer`)
    }
    if (!Number.isInteger(grid.rows) || grid.rows <= 0) {
        errors.push(`${label} frame rows must be a positive integer`)
    }
}

function validateCharacterClips(character: CharacterDefinition, errors: string[]): void {
    const frameCount = character.frame.columns * character.frame.rows

    for (const [clipName, clip] of Object.entries(character.clips)) {
        if (clip.frames.length === 0) {
            errors.push(`character '${character.id}' clip '${clipName}' must include at least one frame`)
        }

        if (clip.fps === undefined && clip.frameDuration === undefined) {
            errors.push(`character '${character.id}' clip '${clipName}' must define fps or frameDuration`)
        }

        for (const frame of clip.frames) {
            if (!Number.isInteger(frame) || frame < 0 || frame >= frameCount) {
                errors.push(`character '${character.id}' clip '${clipName}' references frame ${frame}, outside 0..${frameCount - 1}`)
            }
        }
    }
}

export class ContentRegistry {
    private readonly imageAssets = new Map<AssetId, ImageAssetDefinition>()
    private readonly characters = new Map<ContentId, CharacterDefinition>()
    private readonly equipment = new Map<ContentId, EquipmentDefinition>()
    private readonly items = new Map<ContentId, ItemDefinition>()

    registerImageAsset(definition: ImageAssetDefinition): this {
        registerUnique(this.imageAssets, definition.id, definition, 'image asset')
        return this
    }

    registerImageAssets(definitions: readonly ImageAssetDefinition[]): this {
        for (const definition of definitions) {
            this.registerImageAsset(definition)
        }

        return this
    }

    registerCharacter(definition: CharacterDefinition): this {
        registerUnique(this.characters, definition.id, definition, 'character')
        return this
    }

    registerEquipment(definition: EquipmentDefinition): this {
        registerUnique(this.equipment, definition.id, definition, 'equipment')
        return this
    }

    registerItem(definition: ItemDefinition): this {
        registerUnique(this.items, definition.id, definition, 'item')
        return this
    }

    getImageAssets(): readonly ImageAssetDefinition[] {
        return [...this.imageAssets.values()]
    }

    getCharacters(): readonly CharacterDefinition[] {
        return [...this.characters.values()]
    }

    getEquipmentDefinitions(): readonly EquipmentDefinition[] {
        return [...this.equipment.values()]
    }

    getItems(): readonly ItemDefinition[] {
        return [...this.items.values()]
    }

    getCharacter(id: ContentId): CharacterDefinition {
        return getRequired(this.characters, id, 'character')
    }

    getEquipment(id: ContentId): EquipmentDefinition {
        return getRequired(this.equipment, id, 'equipment')
    }

    getItem(id: ContentId): ItemDefinition {
        return getRequired(this.items, id, 'item')
    }

    validate(): string[] {
        const errors: string[] = []

        for (const character of this.characters.values()) {
            validateAssetReference(this.imageAssets, character.atlas, `character '${character.id}' atlas`, errors)
            validateGrid(character.frame, `character '${character.id}'`, errors)
            validateCharacterClips(character, errors)
        }

        for (const equipment of this.equipment.values()) {
            if (equipment.layers.length === 0) {
                errors.push(`equipment '${equipment.id}' must define at least one visual layer`)
            }

            for (const layer of equipment.layers) {
                validateAssetReference(this.imageAssets, layer.atlas, `equipment '${equipment.id}' layer '${layer.id}'`, errors)
            }
        }

        for (const item of this.items.values()) {
            validateAssetReference(this.imageAssets, item.icon, `item '${item.id}' icon`, errors)
            validateSize(item.pickup.size, `item '${item.id}' pickup`, errors)

            for (const effect of item.effects) {
                if (!this.equipment.has(effect.equipment)) {
                    errors.push(`item '${item.id}' references unknown equipment '${effect.equipment}'`)
                }
            }
        }

        return errors
    }

    assertValid(): void {
        const errors = this.validate()

        if (errors.length > 0) {
            throw new Error(`Content registry validation failed:\n${errors.map((error) => `- ${error}`).join('\n')}`)
        }
    }
}

export function resolveEquipmentLayerOrder(order: EquipmentLayerOrder): number {
    switch (order) {
        case 'behindBody':
            return 10
        case 'heldItem':
            return 30
        case 'frontAccessory':
            return 40
        default:
            return order
    }
}
