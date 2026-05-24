import type { Rect, Vec2 } from '@strange-path/engine'
import type { ItemEffectDefinition, SpriteSheet } from '@strange-path/engine'

export type PickupItemEntity = Vec2 & {
    id: string
    kind: string
    width: number
    height: number
    spriteSheet: SpriteSheet
    effects: readonly ItemEffectDefinition[]
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
