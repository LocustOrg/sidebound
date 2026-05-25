import { defineItem } from '@sidebound/engine'
import { spriteAssetIds } from '../assets.ts'

export const redCapeItem = defineItem({
    id: 'redCapeItem',
    icon: spriteAssetIds.redCapeIcon,
    pickup: { size: { width: 16, height: 16 } },
    effects: [{ type: 'equip', equipment: 'redCape' }],
})

export const ironSwordItem = defineItem({
    id: 'ironSwordItem',
    icon: spriteAssetIds.ironSwordIcon,
    pickup: { size: { width: 16, height: 16 } },
    effects: [{ type: 'equip', equipment: 'ironSword' }],
})
