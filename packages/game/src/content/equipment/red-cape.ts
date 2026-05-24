import { defineEquipment } from '@strange-path/engine'
import { spriteAssetIds } from '../assets'

export const redCapeEquipment = defineEquipment({
    id: 'redCape',
    slot: 'back',
    layers: [
        { id: 'redCapeBack', atlas: spriteAssetIds.redCapeBack, order: 'behindBody', align: 'characterFrame' },
        { id: 'redCapeFront', atlas: spriteAssetIds.redCapeFront, order: 'frontAccessory', align: 'characterFrame' },
    ],
})
