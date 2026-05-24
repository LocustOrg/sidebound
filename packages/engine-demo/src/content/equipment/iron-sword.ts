import { defineEquipment } from '@strange-path/engine'
import { spriteAssetIds } from '../assets'

export const ironSwordEquipment = defineEquipment({
    id: 'ironSword',
    slot: 'mainHand',
    layers: [{ id: 'ironSwordEquipped', atlas: spriteAssetIds.ironSwordEquipped, order: 'heldItem', align: 'characterFrame' }],
})
