import type { Rect } from '../core/geometry'
import { rectsIntersect } from '../core/geometry'
import type { PlayerMob } from '../entities/player-mob'
import { getPickupItemRect, type EquipmentItemKind, type PickupItemEntity } from '../entities/item-entity'

type PickupContext = {
    player: PlayerMob
}

type PickupEffectResolver = (context: PickupContext) => void

const equipmentResolvers: Record<EquipmentItemKind, PickupEffectResolver> = {
    cape: ({ player }) => player.setEquipment({ cape: true }),
    sword: ({ player }) => player.setEquipment({ sword: true }),
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
        const playerRect = this.context.player.getRect()

        for (let index = this.items.length - 1; index >= 0; index -= 1) {
            const item = this.items[index]

            if (!rectsIntersect(playerRect, getPickupItemRect(item))) {
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
        if (item.effect.type === 'equip') {
            equipmentResolvers[item.effect.equipment](this.context)
        }
    }
}
