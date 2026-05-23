import type { Rect, Vec2 } from '../core/geometry'
import type { SpriteSheet } from '../sprites/sprite-sheet'

export type EquipmentItemKind = 'cape' | 'sword'

export type PickupEffect = {
    type: 'equip'
    equipment: EquipmentItemKind
}

export type PickupItemEntity = Vec2 & {
    id: string
    kind: EquipmentItemKind
    width: number
    height: number
    spriteSheet: SpriteSheet
    effect: PickupEffect
    frameIndex?: number
    flipX?: boolean
}

export function getPickupItemRect(item: PickupItemEntity): Rect {
    return {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
    }
}
