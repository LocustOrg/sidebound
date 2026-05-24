import type { ContentRegistry, SpriteSheet, Vec2 } from '@strange-path/engine'
import type { PickupItemEntity } from '../entities/item-entity'

export class ItemFactory {
    private readonly registry: ContentRegistry
    private readonly iconSheets: Readonly<Record<string, SpriteSheet>>

    constructor(registry: ContentRegistry, iconSheets: Readonly<Record<string, SpriteSheet>>) {
        this.registry = registry
        this.iconSheets = iconSheets
    }

    createPickup(itemId: string, position: Vec2, id = itemId): PickupItemEntity {
        const definition = this.registry.getItem(itemId)
        const spriteSheet = this.iconSheets[definition.id]

        return {
            id,
            kind: definition.id,
            x: position.x,
            y: position.y,
            width: definition.pickup.size.width,
            height: definition.pickup.size.height,
            spriteSheet,
            effects: definition.effects,
        }
    }
}
