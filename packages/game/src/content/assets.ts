import playerBaseUrl from '../assets/sprites/player-base.png'
import capeBackUrl from '../assets/sprites/cape-back.png'
import capeFrontUrl from '../assets/sprites/cape-front.png'
import capeIconUrl from '../assets/sprites/cape-icon.png'
import swordEquippedUrl from '../assets/sprites/sword-equipped.png'
import swordIconUrl from '../assets/sprites/sword-icon.png'
import type { ImageAssetDefinition } from '@sidebound/engine'

export const spriteAssetIds = {
    playerBase: 'characters/player/base',
    redCapeBack: 'equipment/red-cape/back',
    redCapeFront: 'equipment/red-cape/front',
    redCapeIcon: 'items/red-cape/icon',
    ironSwordEquipped: 'equipment/iron-sword/equipped',
    ironSwordIcon: 'items/iron-sword/icon',
} as const

export const spriteAssets: readonly ImageAssetDefinition[] = [
    { id: spriteAssetIds.playerBase, url: playerBaseUrl },
    { id: spriteAssetIds.redCapeBack, url: capeBackUrl },
    { id: spriteAssetIds.redCapeFront, url: capeFrontUrl },
    { id: spriteAssetIds.redCapeIcon, url: capeIconUrl },
    { id: spriteAssetIds.ironSwordEquipped, url: swordEquippedUrl },
    { id: spriteAssetIds.ironSwordIcon, url: swordIconUrl },
]
