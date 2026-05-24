import { defineCharacter } from '@sidebound/engine'
import { spriteAssetIds } from '../assets'

export const playerCharacter = defineCharacter({
    id: 'player',
    atlas: spriteAssetIds.playerBase,
    frame: { width: 32, height: 32, columns: 8, rows: 6 },
    hitbox: { width: 8, height: 28 },
    spriteOffset: { x: -13, y: -3 },
    clips: {
        idle: { frames: [0, 1, 2, 3, 4, 5], fps: 9, loop: true },
        run: { frames: [8, 9, 10, 11, 12, 13, 14, 15], fps: 18, loop: true },
        jump: { frames: [16, 17, 18], fps: 10, loop: false },
        fall: { frames: [24, 25, 26], fps: 10.5, loop: true },
        land: { frames: [32, 33, 34, 35], fps: 20, loop: false },
        stop: { frames: [40, 41, 42, 43], fps: 20, loop: false },
    },
    frameMetadata: Object.fromEntries(Array.from({ length: 8 * 6 }, (_, frame) => [frame, { frame }])),
})
