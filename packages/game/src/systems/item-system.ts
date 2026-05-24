import type { Rect } from '@strange-path/engine'
import { rectsIntersect } from '@strange-path/engine'
import { getPickupItemRect, type PickupItemEntity } from '../entities/item-entity'

export type EquipmentHolder = {
    getRect(): Rect
    equip(equipmentId: string): void
}

type PickupContext = {
    equipmentHolder: EquipmentHolder
}

export class ItemSystem {
    private readonly items: PickupItemEntity[] = []
    private readonly context: PickupContext

    constructor(context: PickupContext) {
        this.context = context
    }

    add(item: PickupItemEntity): void {
        this.items.push(item)
    }

    remove(item: PickupItemEntity): void {
        const index = this.items.indexOf(item)
        if (index !== -1) this.items.splice(index, 1)
    }

    update(): void {
        const holderRect = this.context.equipmentHolder.getRect()

        for (let index = this.items.length - 1; index >= 0; index -= 1) {
            const item = this.items[index]

            if (!rectsIntersect(holderRect, getPickupItemRect(item))) {
                continue
            }

            this.applyPickupEffect(item)
            this.items.splice(index, 1)
        }
    }

    getItems(): readonly PickupItemEntity[] {
        return this.items
    }

    getDebugRects(): Rect[] {
        return this.items.map(getPickupItemRect)
    }

    private applyPickupEffect(item: PickupItemEntity): void {
        for (const effect of item.effects) {
            this.context.equipmentHolder.equip(effect.equipment)
        }
    }
}
