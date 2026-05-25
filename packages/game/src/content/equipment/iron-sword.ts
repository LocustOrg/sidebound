import { defineEquipment } from '@sidebound/engine'
import { spriteAssetIds } from '../assets.ts'

export const ironSwordEquipment = defineEquipment({
    id: 'ironSword',
    slot: 'mainHand',
    layers: [{ id: 'ironSwordEquipped', atlas: spriteAssetIds.ironSwordEquipped, order: 'heldItem', align: 'characterFrame' }],
})
