import type { Animator, AnimationClip, SpriteClipDefinition } from '@strange-path/engine'
import { playerCharacter } from '../content/characters/player'

export const PLAYER_FRAME_WIDTH = playerCharacter.frame.width
export const PLAYER_FRAME_HEIGHT = playerCharacter.frame.height
export const PLAYER_SHEET_COLUMNS = playerCharacter.frame.columns
export const PLAYER_SHEET_ROWS = playerCharacter.frame.rows

export type PlayerAnimationFrameSockets = {
    mainHand?: {
        x: number
        y: number
        angle: number
    }
}

export type PlayerAnimationFrameMetadata = {
    frame: number
    sockets?: PlayerAnimationFrameSockets
}

function resolveFrameDuration(clip: SpriteClipDefinition): number {
    if (clip.frameDuration !== undefined) {
        return clip.frameDuration
    }

    if (clip.fps !== undefined && clip.fps > 0) {
        return 1 / clip.fps
    }

    throw new Error('Animation clip must define a positive fps or frameDuration')
}

export const PLAYER_ANIMATION_CLIPS: AnimationClip[] = Object.entries(playerCharacter.clips).map(([name, clip]) => ({
    name,
    frames: clip.frames,
    frameDuration: resolveFrameDuration(clip),
    loop: clip.loop,
}))

export const PLAYER_FRAME_METADATA: Record<number, PlayerAnimationFrameMetadata> = Object.fromEntries(
    Object.entries(playerCharacter.frameMetadata ?? {}).map(([frame, metadata]) => [Number(frame), metadata]),
)

export function registerPlayerAnimationClips(animator: Animator): Animator {
    for (const clip of PLAYER_ANIMATION_CLIPS) {
        animator.addClip(clip)
    }

    animator.play('idle')
    return animator
}
