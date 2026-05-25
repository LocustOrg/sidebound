import type { ImageAssetDefinition } from '@sidebound/engine'

function spriteUrl(fileName: string): string {
    return `/assets/sprites/${fileName}`
}

export const spriteAssetIds = {
    playerBase: 'characters/player/base',
    redCapeBack: 'equipment/red-cape/back',
    redCapeFront: 'equipment/red-cape/front',
    redCapeIcon: 'items/red-cape/icon',
    ironSwordEquipped: 'equipment/iron-sword/equipped',
    ironSwordIcon: 'items/iron-sword/icon',
} as const

export const spriteAssets: readonly ImageAssetDefinition[] = [
    { id: spriteAssetIds.playerBase, url: spriteUrl('player-base.png') },
    { id: spriteAssetIds.redCapeBack, url: spriteUrl('cape-back.png') },
    { id: spriteAssetIds.redCapeFront, url: spriteUrl('cape-front.png') },
    { id: spriteAssetIds.redCapeIcon, url: spriteUrl('cape-icon.png') },
    { id: spriteAssetIds.ironSwordEquipped, url: spriteUrl('sword-equipped.png') },
    { id: spriteAssetIds.ironSwordIcon, url: spriteUrl('sword-icon.png') },
]
