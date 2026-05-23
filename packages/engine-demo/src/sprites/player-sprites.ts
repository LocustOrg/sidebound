/* eslint-disable @typescript-eslint/no-use-before-define */

import BezierEasing from 'bezier-easing'
import type { Animator, AnimationClip } from './animator'
import { createProceduralSheet, type SpriteSheet } from './sprite-sheet'

/**
 * Original dark-fantasy player look.
 *
 * Instead of hand-maintaining large bitmap arrays, this module builds a stylized
 * procedural sprite sheet using layered canvas shapes and eased key poses.
 * That keeps the current canvas pipeline lightweight while giving the player a
 * cleaner silhouette, smoother motion, and more deliberate on-screen presence.
 */

const FRAME_W = 32
const FRAME_H = 32
const COLS = 8
const ROWS = 6
const TAU = Math.PI * 2

const idleEase = BezierEasing(0.45, 0, 0.55, 1)
const runEase = BezierEasing(0.2, 0.85, 0.35, 1)
const jumpEase = BezierEasing(0.32, 0, 0.2, 1)
const fallEase = BezierEasing(0.18, 0.7, 0.3, 1)
const recoverEase = BezierEasing(0.15, 0.9, 0.25, 1)

const PLAYER_ANIMATION_CLIPS: AnimationClip[] = [
    { name: 'idle', frames: [0, 1, 2, 3, 4, 5], frameDuration: 0.11, loop: true },
    { name: 'run', frames: [8, 9, 10, 11, 12, 13, 14, 15], frameDuration: 0.055, loop: true },
    { name: 'jump', frames: [16, 17, 18], frameDuration: 0.1, loop: false },
    { name: 'fall', frames: [24, 25, 26], frameDuration: 0.095, loop: true },
    { name: 'land', frames: [32, 33, 34, 35], frameDuration: 0.05, loop: false },
    { name: 'stop', frames: [40, 41, 42, 43], frameDuration: 0.05, loop: false },
]

type CharacterPose = {
    bob: number
    pelvisX: number
    torsoLean: number
    shoulderLift: number
    headTilt: number
    swordAngle: number
    swordReach: number
    swordLift: number
    cloakSwing: number
    cloakLift: number
    frontStep: number
    backStep: number
    frontFootLift: number
    backFootLift: number
    frontKneeOffset: number
    backKneeOffset: number
    stretch: number
    squash: number
    airborne: number
    eyeGlow: number
}

type Point = {
    x: number
    y: number
}

type FrameSpec = {
    index: number
    pose: CharacterPose
}

type PlayerFrameGeometry = {
    groundY: number
    liftY: number
    hips: Point
    torsoTop: Point
    shoulderY: number
    backShoulder: Point
    frontShoulder: Point
    backKnee: Point
    frontKnee: Point
    backFoot: Point
    frontFoot: Point
    headCenter: Point
    backElbow: Point
    backHand: Point
    frontElbow: Point
    frontHand: Point
    swordElbow: Point
    swordHand: Point
}

const colors = {
    rim: '#d2cedd',
    outline: '#120f17',
    shadow: '#201926',
    steelDark: '#413b4d',
    steelMid: '#615a72',
    steelLight: '#9188a3',
    leather: '#594433',
    leatherLight: '#8d6a4d',
    capeDark: '#2b1820',
    capeMid: '#4a2735',
    capeLight: '#764258',
    cloth: '#34313f',
    gold: '#b6975e',
    eye: '#9be7ff',
    blade: '#d7dce7',
    bladeEdge: '#f8fbff',
    skin: '#c7a47f',
    skinShadow: '#8d6a4d',
}

export function registerPlayerAnimationClips(animator: Animator): Animator {
    for (const clip of PLAYER_ANIMATION_CLIPS) {
        animator.addClip(clip)
    }

    animator.play('idle')
    return animator
}

export function createPlayerSpriteSheet(): SpriteSheet {
    return createPlayerFrameSheet(drawPlayerFrame)
}

export function createPlayerCapeOverlaySheet(): SpriteSheet {
    return createPlayerCapeFrontOverlaySheet()
}

export function createPlayerCapeBackOverlaySheet(): SpriteSheet {
    return createPlayerFrameSheet(drawCapeBackOverlayFrame)
}

export function createPlayerCapeFrontOverlaySheet(): SpriteSheet {
    return createPlayerFrameSheet(drawCapeFrontOverlayFrame)
}

export function createPlayerSwordOverlaySheet(): SpriteSheet {
    return createPlayerFrameSheet(drawSwordOverlayFrame)
}

function createPlayerFrameSheet(drawFrame: (context: CanvasRenderingContext2D, pose: CharacterPose, frameWidth: number, frameHeight: number) => void): SpriteSheet {
    const frameSpecs = buildFrameSpecs()

    return createProceduralSheet(FRAME_W, FRAME_H, COLS, ROWS, (context, frameWidth, frameHeight) => {
        for (const frame of frameSpecs) {
            const col = frame.index % COLS
            const row = Math.floor(frame.index / COLS)
            const ox = col * frameWidth
            const oy = row * frameHeight

            context.save()
            context.beginPath()
            context.rect(ox, oy, frameWidth, frameHeight)
            context.clip()
            context.translate(ox, oy)
            drawFrame(context, frame.pose, frameWidth, frameHeight)
            context.restore()
        }
    })
}

function buildFrameSpecs(): FrameSpec[] {
    const specs: FrameSpec[] = []

    for (let index = 0; index < 6; index += 1) {
        specs.push({ index, pose: createIdlePose(index / 6) })
    }

    for (let index = 0; index < 8; index += 1) {
        specs.push({ index: 8 + index, pose: createRunPose(index / 8) })
    }

    for (let index = 0; index < 3; index += 1) {
        const t = index / 2
        specs.push({ index: 16 + index, pose: createJumpPose(t) })
    }

    for (let index = 0; index < 3; index += 1) {
        const t = index / 2
        specs.push({ index: 24 + index, pose: createFallPose(t) })
    }

    for (let index = 0; index < 4; index += 1) {
        const t = index / 3
        specs.push({ index: 32 + index, pose: createLandPose(t) })
    }

    for (let index = 0; index < 4; index += 1) {
        const t = index / 3
        specs.push({ index: 40 + index, pose: createStopPose(t) })
    }

    return specs
}

function createIdlePose(t: number): CharacterPose {
    const sway = Math.sin(t * TAU)
    const breath = idleEase((Math.cos(t * TAU - Math.PI) + 1) / 2)

    return {
        bob: -0.8 - breath * 0.45,
        pelvisX: sway * 0.18,
        torsoLean: sway * 0.05,
        shoulderLift: breath * 0.2,
        headTilt: sway * 0.03,
        swordAngle: -0.82 + sway * 0.035,
        swordReach: -0.2,
        swordLift: breath * 0.12,
        cloakSwing: -1.6 - sway * 0.6,
        cloakLift: 0.5 + breath * 0.4,
        frontStep: 0.18,
        backStep: -0.2,
        frontFootLift: Math.max(0, sway) * 0.18,
        backFootLift: Math.max(0, -sway) * 0.12,
        frontKneeOffset: sway * 0.12,
        backKneeOffset: -sway * 0.12,
        stretch: 0.06 + breath * 0.08,
        squash: (1 - breath) * 0.05,
        airborne: 0,
        eyeGlow: 0.82 + breath * 0.14,
    }
}

function createRunPose(t: number): CharacterPose {
    const stride = Math.sin(t * TAU)
    const contact = runEase((Math.cos(t * TAU) + 1) / 2)
    const bounce = Math.max(0, Math.cos(t * TAU * 2))

    return {
        bob: -0.35 - bounce * 0.35,
        pelvisX: stride * 0.55,
        torsoLean: 0.12 + stride * 0.025,
        shoulderLift: Math.max(0, -stride) * 0.35,
        headTilt: stride * 0.025,
        swordAngle: -0.82 + stride * 0.05,
        swordReach: -1.15 + contact * 0.3,
        swordLift: -0.22 + Math.max(0, -stride) * 0.25,
        cloakSwing: -2.7 - stride * 2.4,
        cloakLift: 1.2 + Math.max(0, stride) * 1.25,
        frontStep: stride * 3.7,
        backStep: -stride * 3.15,
        frontFootLift: Math.max(0, -stride) * 1.85,
        backFootLift: Math.max(0, stride) * 1.45,
        frontKneeOffset: stride * 0.5,
        backKneeOffset: -stride * 0.55,
        stretch: 0.32 + contact * 0.2,
        squash: Math.max(0, -Math.cos(t * TAU * 2)) * 0.32,
        airborne: Math.max(0, Math.sin((t + 0.25) * TAU)) * 0.15,
        eyeGlow: 0.94,
    }
}

function createJumpPose(t: number): CharacterPose {
    const lift = jumpEase(clamp01(t))

    return {
        bob: -1.2 - lift * 0.95,
        pelvisX: 0.18 + lift * 0.2,
        torsoLean: 0.08 + lift * 0.06,
        shoulderLift: -0.1,
        headTilt: 0.02,
        swordAngle: -0.92 - lift * 0.08,
        swordReach: 0.55 + lift * 0.35,
        swordLift: -0.75 - lift * 0.2,
        cloakSwing: -2.2 - lift * 1.05,
        cloakLift: 2.1 + lift * 0.8,
        frontStep: 0.9 - lift * 0.2,
        backStep: -1.15 - lift * 0.2,
        frontFootLift: 1.1 + lift * 0.9,
        backFootLift: 0.8 + lift * 0.6,
        frontKneeOffset: 0.35,
        backKneeOffset: -0.4,
        stretch: 0.35 + lift * 0.7,
        squash: (1 - lift) * 0.25,
        airborne: 0.7 + lift * 0.8,
        eyeGlow: 1,
    }
}

function createFallPose(t: number): CharacterPose {
    const descend = fallEase(clamp01(t))

    return {
        bob: -2.2 - descend * 0.2,
        pelvisX: -0.08,
        torsoLean: -0.05,
        shoulderLift: 0.18,
        headTilt: -0.03,
        swordAngle: -0.64 - descend * 0.08,
        swordReach: -0.2 - descend * 0.15,
        swordLift: 0.65 + descend * 0.25,
        cloakSwing: -3.4 - descend * 0.5,
        cloakLift: 3.4 - descend * 0.5,
        frontStep: 1.1 - descend * 0.25,
        backStep: -1.2 - descend * 0.15,
        frontFootLift: 2.2,
        backFootLift: 1.8,
        frontKneeOffset: -0.2,
        backKneeOffset: 0.2,
        stretch: 0.25,
        squash: 0.08,
        airborne: 1.35,
        eyeGlow: 0.92,
    }
}

function createLandPose(t: number): CharacterPose {
    const recover = recoverEase(clamp01(t))
    const impact = 1 - recover

    return {
        bob: -0.15 + recover * 0.2,
        pelvisX: 0.1 - recover * 0.06,
        torsoLean: 0.12 - recover * 0.1,
        shoulderLift: impact * 0.42,
        headTilt: impact * -0.04,
        swordAngle: -0.92 + recover * 0.14,
        swordReach: 0.25 - recover * 0.4,
        swordLift: -0.25 + recover * 0.45,
        cloakSwing: -3.1 + recover * 1.7,
        cloakLift: 2.4 * impact,
        frontStep: 0.45 - recover * 0.18,
        backStep: -0.48 + recover * 0.14,
        frontFootLift: impact * 0.7,
        backFootLift: impact * 0.4,
        frontKneeOffset: 0.12,
        backKneeOffset: -0.08,
        stretch: 0.1 + recover * 0.2,
        squash: impact * 0.78,
        airborne: impact * 0.45,
        eyeGlow: 0.98,
    }
}

function createStopPose(t: number): CharacterPose {
    return mixPoses(createRunPose(0.16 + t * 0.14), createIdlePose(0), recoverEase(clamp01(t)))
}

function mixPoses(left: CharacterPose, right: CharacterPose, weight: number): CharacterPose {
    return {
        bob: mix(left.bob, right.bob, weight),
        pelvisX: mix(left.pelvisX, right.pelvisX, weight),
        torsoLean: mix(left.torsoLean, right.torsoLean, weight),
        shoulderLift: mix(left.shoulderLift, right.shoulderLift, weight),
        headTilt: mix(left.headTilt, right.headTilt, weight),
        swordAngle: mix(left.swordAngle, right.swordAngle, weight),
        swordReach: mix(left.swordReach, right.swordReach, weight),
        swordLift: mix(left.swordLift, right.swordLift, weight),
        cloakSwing: mix(left.cloakSwing, right.cloakSwing, weight),
        cloakLift: mix(left.cloakLift, right.cloakLift, weight),
        frontStep: mix(left.frontStep, right.frontStep, weight),
        backStep: mix(left.backStep, right.backStep, weight),
        frontFootLift: mix(left.frontFootLift, right.frontFootLift, weight),
        backFootLift: mix(left.backFootLift, right.backFootLift, weight),
        frontKneeOffset: mix(left.frontKneeOffset, right.frontKneeOffset, weight),
        backKneeOffset: mix(left.backKneeOffset, right.backKneeOffset, weight),
        stretch: mix(left.stretch, right.stretch, weight),
        squash: mix(left.squash, right.squash, weight),
        airborne: mix(left.airborne, right.airborne, weight),
        eyeGlow: mix(left.eyeGlow, right.eyeGlow, weight),
    }
}

function buildPlayerFrameGeometry(pose: CharacterPose, frameWidth: number, frameHeight: number): PlayerFrameGeometry {
    const groundY = frameHeight - 3
    const centerX = frameWidth * 0.5 + pose.pelvisX
    const liftY = pose.airborne * 1.2
    const hips: Point = {
        x: centerX,
        y: groundY - 8.9 + pose.bob - liftY + pose.squash * 0.5,
    }
    const torsoHeight = 7.1 + pose.stretch * 1.4 - pose.squash * 0.9
    const torsoTop: Point = {
        x: hips.x + pose.torsoLean * 7,
        y: hips.y - torsoHeight,
    }
    const shoulderY = torsoTop.y + 1.9 - pose.shoulderLift
    const backShoulder: Point = { x: torsoTop.x - 2.45, y: shoulderY + 0.25 }
    const frontShoulder: Point = { x: torsoTop.x + 2.25, y: shoulderY - 0.15 }
    const backKnee: Point = {
        x: hips.x - 1.4 + pose.backStep * 0.38 + pose.backKneeOffset,
        y: hips.y + 3.7 + Math.abs(pose.backStep) * 0.14,
    }
    const frontKnee: Point = {
        x: hips.x + 1.45 + pose.frontStep * 0.45 + pose.frontKneeOffset,
        y: hips.y + 3.95 + Math.abs(pose.frontStep) * 0.16,
    }
    const backFoot: Point = {
        x: hips.x - 2.4 + pose.backStep,
        y: groundY - pose.backFootLift - liftY,
    }
    const frontFoot: Point = {
        x: hips.x + 2.8 + pose.frontStep,
        y: groundY - pose.frontFootLift - liftY,
    }
    const headCenter: Point = {
        x: torsoTop.x + 0.5,
        y: torsoTop.y - 3.35 + pose.headTilt * 3,
    }
    const armSwing = (pose.frontStep - pose.backStep) * 0.28
    const backElbow: Point = {
        x: torsoTop.x - 5.1 - armSwing * 0.45,
        y: shoulderY + 2.05 - armSwing * 0.12 + pose.backFootLift * 0.1,
    }
    const backHand: Point = {
        x: torsoTop.x - 4.05 - armSwing * 0.82,
        y: shoulderY + 4.75 - armSwing * 0.18 + pose.backFootLift * 0.12,
    }
    const frontElbow: Point = {
        x: torsoTop.x + 4.45 + armSwing * 0.34,
        y: shoulderY + 2.3 + armSwing * 0.1 + pose.frontFootLift * 0.08,
    }
    const frontHand: Point = {
        x: torsoTop.x + 3.35 + armSwing * 0.62,
        y: shoulderY + 4.45 + armSwing * 0.14 + pose.frontFootLift * 0.1,
    }
    const swordElbow: Point = {
        x: torsoTop.x + 3.7 + pose.swordReach * 0.3,
        y: shoulderY + 2.5 + pose.swordLift * 0.5,
    }
    const swordHand: Point = {
        x: torsoTop.x + 5.35 + pose.swordReach,
        y: shoulderY + 4.35 + pose.swordLift,
    }

    return {
        groundY,
        liftY,
        hips,
        torsoTop,
        shoulderY,
        backShoulder,
        frontShoulder,
        backKnee,
        frontKnee,
        backFoot,
        frontFoot,
        headCenter,
        backElbow,
        backHand,
        frontElbow,
        frontHand,
        swordElbow,
        swordHand,
    }
}

function drawPlayerFrame(context: CanvasRenderingContext2D, pose: CharacterPose, frameWidth: number, frameHeight: number): void {
    const geometry = buildPlayerFrameGeometry(pose, frameWidth, frameHeight)

    context.lineJoin = 'round'
    context.lineCap = 'round'

    drawBackGlow(context, geometry.headCenter.x - 1.5, geometry.torsoTop.y + 3.5, frameWidth * 0.42, pose.eyeGlow)
    drawPlayerArm(context, geometry.frontShoulder, geometry.frontElbow, geometry.frontHand, colors.steelDark)
    drawLeg(context, geometry.hips, geometry.backKnee, geometry.backFoot, 3.1, colors.outline, colors.shadow, colors.leather)
    drawTorso(context, geometry.torsoTop, geometry.hips, pose)
    drawPlayerArm(context, geometry.backShoulder, geometry.backElbow, geometry.backHand, colors.steelMid)
    drawHead(context, geometry.headCenter, pose)
    drawLeg(context, geometry.hips, geometry.frontKnee, geometry.frontFoot, 3.5, colors.outline, colors.steelDark, colors.leatherLight)
    drawFrontTrim(context, geometry.torsoTop, geometry.hips, pose)
}

function drawCapeBackOverlayFrame(context: CanvasRenderingContext2D, pose: CharacterPose, frameWidth: number, frameHeight: number): void {
    const geometry = buildPlayerFrameGeometry(pose, frameWidth, frameHeight)

    context.lineJoin = 'round'
    context.lineCap = 'round'

    drawCape(context, geometry.torsoTop, geometry.groundY - geometry.liftY, pose, false)
}

function drawCapeFrontOverlayFrame(context: CanvasRenderingContext2D, pose: CharacterPose, frameWidth: number, frameHeight: number): void {
    const geometry = buildPlayerFrameGeometry(pose, frameWidth, frameHeight)

    context.lineJoin = 'round'
    context.lineCap = 'round'

    drawCape(context, geometry.torsoTop, geometry.groundY - geometry.liftY, pose, true)
}

function drawSwordOverlayFrame(context: CanvasRenderingContext2D, pose: CharacterPose, frameWidth: number, frameHeight: number): void {
    const geometry = buildPlayerFrameGeometry(pose, frameWidth, frameHeight)

    context.lineJoin = 'round'
    context.lineCap = 'round'

    drawSword(context, geometry.swordHand, pose.swordAngle)
    drawArm(context, [geometry.frontShoulder, geometry.swordElbow, geometry.swordHand], 3.6, colors.outline, colors.steelMid)
}

function drawBackGlow(context: CanvasRenderingContext2D, x: number, y: number, radius: number, intensity: number): void {
    context.save()
    context.globalCompositeOperation = 'screen'
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(148, 232, 255, ${0.08 + intensity * 0.05})`)
    gradient.addColorStop(1, 'rgba(148, 232, 255, 0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(x, y, radius, 0, TAU)
    context.fill()
    context.restore()
}

function drawCape(context: CanvasRenderingContext2D, torsoTop: Point, hemY: number, pose: CharacterPose, foreground: boolean): void {
    const shoulderX = torsoTop.x - (foreground ? 1.2 : 2.6)
    const shoulderY = torsoTop.y + (foreground ? 1.5 : 1.1)
    const trail = pose.cloakSwing
    const lift = pose.cloakLift
    const hemX = torsoTop.x - 4.6 + trail

    context.save()
    context.beginPath()
    context.moveTo(shoulderX, shoulderY)
    context.quadraticCurveTo(torsoTop.x - 6.4 + trail * 0.5, torsoTop.y + 5.2 - lift * 0.35, hemX, hemY - 0.4)
    context.quadraticCurveTo(torsoTop.x - 2.1 + trail * 0.2, hemY - 1.8 + lift * 0.12, torsoTop.x - 0.75, torsoTop.y + 5.4)
    context.closePath()
    context.fillStyle = foreground ? colors.capeMid : colors.capeDark
    context.fill()

    context.strokeStyle = foreground ? colors.capeLight : colors.capeMid
    context.lineWidth = foreground ? 1.15 : 0.9
    context.beginPath()
    context.moveTo(shoulderX + 0.15, shoulderY + 0.3)
    context.quadraticCurveTo(torsoTop.x - 5.1 + trail * 0.42, torsoTop.y + 6 - lift * 0.25, hemX + 1.1, hemY - 2.1)
    context.stroke()
    context.restore()
}

function drawTorso(context: CanvasRenderingContext2D, torsoTop: Point, hips: Point, pose: CharacterPose): void {
    const bodyWidth = 7.4
    const bodyHeight = hips.y - torsoTop.y - 0.3
    const left = torsoTop.x - bodyWidth * 0.5
    const top = torsoTop.y + 1.2

    fillRoundedRect(context, left, top, bodyWidth, bodyHeight, 2.4, colors.outline)
    fillRoundedRect(context, left + 0.8, top + 0.65, bodyWidth - 1.6, bodyHeight - 1.2, 1.8, colors.steelDark)
    fillRoundedRect(context, left + 1.6, top + 1.2, bodyWidth - 3.1, bodyHeight - 2.4, 1.3, colors.steelMid)

    context.fillStyle = colors.steelLight
    context.fillRect(left + 2.25, top + 1.45, 1, Math.max(2.4, bodyHeight - 4.4))

    context.fillStyle = colors.cloth
    fillRoundedRect(context, torsoTop.x - 1.9, top + 0.25, 3.8, 2.2 + pose.stretch * 0.2, 1.2, colors.cloth)

    context.fillStyle = colors.gold
    context.fillRect(left + 1.1, hips.y - 2.6, bodyWidth - 2.2, 0.9)
}

function drawFrontTrim(context: CanvasRenderingContext2D, torsoTop: Point, hips: Point, pose: CharacterPose): void {
    context.save()
    context.strokeStyle = colors.rim
    context.lineWidth = 0.9
    context.beginPath()
    context.moveTo(torsoTop.x + 0.9, torsoTop.y + 4.8)
    context.lineTo(torsoTop.x + 1.8 + pose.torsoLean * 0.5, hips.y - 1.1)
    context.stroke()
    context.restore()
}

function drawHead(context: CanvasRenderingContext2D, center: Point, pose: CharacterPose): void {
    context.save()
    context.fillStyle = colors.outline
    context.beginPath()
    context.ellipse(center.x, center.y, 3.6, 3.9, pose.headTilt, 0, TAU)
    context.fill()

    context.fillStyle = colors.steelDark
    context.beginPath()
    context.ellipse(center.x + 0.2, center.y, 3.05, 3.3, pose.headTilt, 0, TAU)
    context.fill()

    context.fillStyle = colors.steelMid
    context.beginPath()
    context.ellipse(center.x + 0.65, center.y - 0.2, 2.35, 2.6, pose.headTilt, 0, TAU)
    context.fill()

    context.fillStyle = colors.steelLight
    context.fillRect(center.x + 1.2, center.y - 1.8, 0.85, 3.2)

    context.shadowBlur = 4
    context.shadowColor = colors.eye
    context.fillStyle = `rgba(155, 231, 255, ${0.72 + pose.eyeGlow * 0.18})`
    context.fillRect(center.x + 0.8, center.y - 0.45, 1.9, 0.8)
    context.restore()
}

function drawArm(context: CanvasRenderingContext2D, points: [Point, Point, Point], width: number, outline: string, fill: string): void {
    strokePath(context, points, width + 1.2, outline)
    strokePath(context, points, width, fill)
}

function drawPlayerArm(context: CanvasRenderingContext2D, shoulder: Point, elbow: Point, fist: Point, sleeve: string): void {
    const wrist: Point = {
        x: elbow.x + (fist.x - elbow.x) * 0.78,
        y: elbow.y + (fist.y - elbow.y) * 0.78,
    }

    strokePath(context, [shoulder, elbow, wrist], 2.85, colors.outline)
    strokePath(context, [shoulder, elbow, wrist], 1.9, sleeve)

    context.save()
    context.fillStyle = colors.outline
    context.beginPath()
    context.ellipse(fist.x, fist.y, 1.05, 0.95, -0.2, 0, TAU)
    context.fill()

    context.fillStyle = colors.skin
    context.beginPath()
    context.ellipse(fist.x + 0.1, fist.y - 0.05, 0.68, 0.58, -0.2, 0, TAU)
    context.fill()

    context.fillStyle = colors.skinShadow
    context.fillRect(fist.x - 0.25, fist.y + 0.1, 0.5, 0.28)
    context.restore()
}

function drawLeg(context: CanvasRenderingContext2D, hips: Point, knee: Point, foot: Point, width: number, outline: string, fill: string, boot: string): void {
    strokePath(context, [hips, knee, foot], width + 1.3, outline)
    strokePath(context, [hips, knee, foot], width, fill)

    context.save()
    context.fillStyle = outline
    context.beginPath()
    context.ellipse(foot.x + 1.15, foot.y + 0.2, 2.45, 1.25, -0.08, 0, TAU)
    context.fill()

    context.fillStyle = boot
    context.beginPath()
    context.ellipse(foot.x + 1.2, foot.y, 1.75, 0.95, -0.08, 0, TAU)
    context.fill()
    context.restore()
}

function drawSword(context: CanvasRenderingContext2D, hand: Point, angle: number): void {
    const bladeLength = 14.2
    const tipX = hand.x + Math.cos(angle) * bladeLength
    const tipY = hand.y + Math.sin(angle) * bladeLength
    const guardX = hand.x - 0.7
    const guardY = hand.y - 0.35

    context.save()
    context.strokeStyle = colors.outline
    context.lineWidth = 2.7
    context.beginPath()
    context.moveTo(hand.x - 2.1, hand.y + 1.9)
    context.lineTo(hand.x + 0.65, hand.y - 0.05)
    context.stroke()

    context.strokeStyle = colors.leather
    context.lineWidth = 1.4
    context.beginPath()
    context.moveTo(hand.x - 1.9, hand.y + 1.65)
    context.lineTo(hand.x + 0.3, hand.y + 0.15)
    context.stroke()

    context.strokeStyle = colors.outline
    context.lineWidth = 2.25
    context.beginPath()
    context.moveTo(guardX - 1.25, guardY + 0.4)
    context.lineTo(guardX + 1.55, guardY - 0.55)
    context.stroke()

    context.strokeStyle = colors.gold
    context.lineWidth = 1.15
    context.beginPath()
    context.moveTo(guardX - 0.8, guardY + 0.2)
    context.lineTo(guardX + 1.1, guardY - 0.35)
    context.stroke()

    context.strokeStyle = colors.blade
    context.lineWidth = 2.05
    context.beginPath()
    context.moveTo(hand.x + 0.4, hand.y - 0.1)
    context.lineTo(tipX, tipY)
    context.stroke()

    context.strokeStyle = colors.bladeEdge
    context.lineWidth = 0.65
    context.beginPath()
    context.moveTo(hand.x + 0.85, hand.y - 0.3)
    context.lineTo(tipX - 0.15, tipY - 0.05)
    context.stroke()
    context.restore()
}

function strokePath(context: CanvasRenderingContext2D, points: Point[], lineWidth: number, color: string): void {
    context.save()
    context.strokeStyle = color
    context.lineWidth = lineWidth
    context.beginPath()
    context.moveTo(points[0].x, points[0].y)

    for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index].x, points[index].y)
    }

    context.stroke()
    context.restore()
}

function fillRoundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, color: string): void {
    const safeRadius = Math.min(radius, width / 2, height / 2)

    context.save()
    context.fillStyle = color
    context.beginPath()
    context.moveTo(x + safeRadius, y)
    context.arcTo(x + width, y, x + width, y + height, safeRadius)
    context.arcTo(x + width, y + height, x, y + height, safeRadius)
    context.arcTo(x, y + height, x, y, safeRadius)
    context.arcTo(x, y, x + width, y, safeRadius)
    context.closePath()
    context.fill()
    context.restore()
}

function clamp01(value: number): number {
    return Math.max(0, Math.min(1, value))
}

function mix(from: number, to: number, t: number): number {
    return from + (to - from) * t
}

