import { ContentRegistry } from '@sidebound/engine'
import { spriteAssets } from './assets.ts'
import { playerCharacter } from './characters/player.ts'
import { ironSwordEquipment } from './equipment/iron-sword.ts'
import { redCapeEquipment } from './equipment/red-cape.ts'
import { ironSwordItem, redCapeItem } from './items/starter-items.ts'

export const demoContent = new ContentRegistry()
    .registerImageAssets(spriteAssets)
    .registerCharacter(playerCharacter)
    .registerEquipment(redCapeEquipment)
    .registerEquipment(ironSwordEquipment)
    .registerItem(redCapeItem)
    .registerItem(ironSwordItem)

export const demoContentIds = {
    player: playerCharacter.id,
    redCapeItem: redCapeItem.id,
    ironSwordItem: ironSwordItem.id,
} as const

export type DemoItemId = (typeof demoContentIds)['redCapeItem'] | (typeof demoContentIds)['ironSwordItem']
