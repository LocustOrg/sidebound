import { PixelEngine } from '@strange-path/engine'
import './style.css'

type Vec2 = {
    x: number
    y: number
}

type Rect = {
    x: number
    y: number
    width: number
    height: number
}

type Segment = {
    x1: number
    y1: number
    x2: number
    y2: number
}

type RayHit = Vec2 & {
    angle: number
    distance: number
}

type MemoryPerformance = Performance & {
    memory?: {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
    }
}

const world = {
    width: 240,
    height: 135,
    solids: [
        { x: 0, y: 0, width: 240, height: 5 },
        { x: 0, y: 130, width: 240, height: 5 },
        { x: 0, y: 0, width: 5, height: 135 },
        { x: 235, y: 0, width: 5, height: 135 },
        { x: 24, y: 102, width: 42, height: 8 },
        { x: 84, y: 84, width: 50, height: 8 },
        { x: 152, y: 68, width: 46, height: 8 },
        { x: 182, y: 104, width: 36, height: 8 },
        { x: 42, y: 46, width: 13, height: 64 },
        { x: 124, y: 45, width: 12, height: 47 },
        { x: 211, y: 76, width: 10, height: 36 },
    ],
}

const controls = {
    maxSpeed: 78,
    groundAcceleration: 780,
    airAcceleration: 430,
    friction: 920,
    gravity: 420,
    jumpVelocity: 155,
}

const movementKeys = new Set(['arrowup', 'arrowleft', 'arrowright', 'w', 'a', 'd', ' '])
const pressedKeys = new Set<string>()
const jumpKeys = new Set(['arrowup', 'w', ' '])
const rayAngleOffset = 0.0001

const canvas = requireElement<HTMLCanvasElement>('#game')
const soundToggle = requireElement<HTMLButtonElement>('#sound-toggle')
const lightingToggle = requireElement<HTMLInputElement>('#debug-lighting')
const collisionToggle = requireElement<HTMLInputElement>('#debug-collision')
const fpsMetric = requireElement<HTMLElement>('#metric-fps')
const frameMetric = requireElement<HTMLElement>('#metric-frame')
const updateMetric = requireElement<HTMLElement>('#metric-update')
const renderMetric = requireElement<HTMLElement>('#metric-render')
const rayTimeMetric = requireElement<HTMLElement>('#metric-ray-time')
const raysMetric = requireElement<HTMLElement>('#metric-rays')
const checksMetric = requireElement<HTMLElement>('#metric-checks')
const memoryMetric = requireElement<HTMLElement>('#metric-memory')
const groundedMetric = requireElement<HTMLElement>('#metric-grounded')
const velocityMetric = requireElement<HTMLElement>('#metric-velocity')

const player = {
    x: 16,
    y: 112,
    width: 8,
    height: 14,
    vx: 0,
    vy: 0,
    grounded: false,
    facing: 1,
    lightRadius: 84,
}

const diagnostics = {
    fps: 0,
    frameMs: 0,
    updateMs: 0,
    renderMs: 0,
    rayMs: 0,
    rays: 0,
    rayChecks: 0,
    showLighting: lightingToggle.checked,
    showCollision: collisionToggle.checked,
}

const occluderSegments = buildSegments(world.solids)
let audioContext: AudioContext | undefined
let soundEnabled = false
let jumpQueued = false
let stepCooldown = 0
let nextMetricsUpdate = 0

window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase()

    if (movementKeys.has(key)) {
        event.preventDefault()
    }

    pressedKeys.add(key)

    if (jumpKeys.has(key) && !event.repeat) {
        jumpQueued = true
    }
})

window.addEventListener('keyup', (event) => {
    pressedKeys.delete(event.key.toLowerCase())
})

soundToggle.addEventListener('click', async () => {
    if (!audioContext) {
        audioContext = new AudioContext()
    }

    if (soundEnabled) {
        soundEnabled = false
        updateSoundButton()
        return
    }

    await audioContext.resume()
    soundEnabled = true
    playTone(196, 0.08, 0.035)
    updateSoundButton()
})

lightingToggle.addEventListener('change', () => {
    diagnostics.showLighting = lightingToggle.checked
})

collisionToggle.addEventListener('change', () => {
    diagnostics.showCollision = collisionToggle.checked
})

const engine = new PixelEngine({
    canvas,
    width: world.width,
    height: world.height,
    scale: 4,
    background: '#111019',
    loop: {
        update(deltaSeconds) {
            const updateStart = performance.now()
            const safeDeltaSeconds = Math.min(deltaSeconds, 0.05)

            diagnostics.frameMs = smooth(diagnostics.frameMs, deltaSeconds * 1000, 0.12)
            diagnostics.fps = smooth(diagnostics.fps, 1 / Math.max(deltaSeconds, 0.0001), 0.12)
            updatePlayer(safeDeltaSeconds)

            diagnostics.updateMs = performance.now() - updateStart
        },
        render(context) {
            const renderStart = performance.now()

            drawArea(context)
            drawPlayer(context)

            const rayStart = performance.now()
            const lightOrigin = getLightOrigin()
            const lightPolygon = castLight(lightOrigin, player.lightRadius)
            diagnostics.rayMs = performance.now() - rayStart

            drawLighting(context, lightPolygon, lightOrigin)

            if (diagnostics.showLighting) {
                drawLightingDebug(context, lightPolygon, lightOrigin)
            }

            if (diagnostics.showCollision) {
                drawCollisionDebug(context)
            }

            diagnostics.renderMs = performance.now() - renderStart
            updateMetrics()
        },
    },
})

updateSoundButton()
engine.start()

function requireElement<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector)

    if (!element) {
        throw new Error(`Missing required element: ${selector}`)
    }

    return element
}

function updatePlayer(deltaSeconds: number): void {
    const horizontal = Number(pressedKeys.has('arrowright') || pressedKeys.has('d')) - Number(pressedKeys.has('arrowleft') || pressedKeys.has('a'))
    const acceleration = player.grounded ? controls.groundAcceleration : controls.airAcceleration
    const targetVx = horizontal * controls.maxSpeed

    if (horizontal !== 0) {
        player.facing = horizontal
        player.vx = approach(player.vx, targetVx, acceleration * deltaSeconds)
    } else if (player.grounded) {
        player.vx = approach(player.vx, 0, controls.friction * deltaSeconds)
    } else {
        player.vx = approach(player.vx, 0, controls.airAcceleration * 0.18 * deltaSeconds)
    }

    if (jumpQueued && player.grounded) {
        player.vy = -controls.jumpVelocity
        player.grounded = false
        playTone(246, 0.09, 0.04)
    }

    jumpQueued = false
    player.vy += controls.gravity * deltaSeconds

    const previousGrounded = player.grounded

    moveHorizontal(player.vx * deltaSeconds)
    moveVertical(player.vy * deltaSeconds)
    playMovementSounds(deltaSeconds, horizontal, previousGrounded)
}

function moveHorizontal(distance: number): void {
    player.x += distance

    for (const solid of world.solids) {
        if (!rectsIntersect(getPlayerRect(), solid)) {
            continue
        }

        if (distance > 0) {
            player.x = solid.x - player.width
        } else if (distance < 0) {
            player.x = solid.x + solid.width
        }

        player.vx = 0
    }
}

function moveVertical(distance: number): void {
    player.y += distance
    player.grounded = false

    for (const solid of world.solids) {
        if (!rectsIntersect(getPlayerRect(), solid)) {
            continue
        }

        if (distance > 0) {
            player.y = solid.y - player.height
            player.grounded = true
        } else if (distance < 0) {
            player.y = solid.y + solid.height
        }

        player.vy = 0
    }
}

function playMovementSounds(deltaSeconds: number, horizontal: number, previousGrounded: boolean): void {
    if (player.grounded && !previousGrounded) {
        playTone(118, 0.08, 0.03)
    }

    if (!player.grounded || horizontal === 0 || Math.abs(player.vx) < 12) {
        stepCooldown = 0
        return
    }

    stepCooldown -= deltaSeconds

    if (stepCooldown <= 0) {
        playTone(76 + Math.round(Math.abs(player.vx) % 20), 0.04, 0.016)
        stepCooldown = 0.16
    }
}

function drawArea(context: CanvasRenderingContext2D): void {
    context.fillStyle = '#111019'
    context.fillRect(0, 0, world.width, world.height)

    const backgroundGradient = context.createLinearGradient(0, 0, 0, world.height)
    backgroundGradient.addColorStop(0, '#15121c')
    backgroundGradient.addColorStop(1, '#0d0c12')
    context.fillStyle = backgroundGradient
    context.fillRect(0, 0, world.width, world.height)

    context.fillStyle = '#191621'

    for (let x = 0; x < world.width; x += 16) {
        context.fillRect(x, 0, 2, world.height)
    }

    context.fillStyle = '#211b28'

    for (let x = 8; x < world.width; x += 32) {
        context.fillRect(x, 24, 8, 106)
    }

    for (const solid of world.solids) {
        drawSolid(context, solid)
    }
}

function drawSolid(context: CanvasRenderingContext2D, solid: Rect): void {
    context.fillStyle = '#393340'
    context.fillRect(solid.x, solid.y, solid.width, solid.height)
    context.fillStyle = '#5a5160'
    context.fillRect(solid.x, solid.y, solid.width, 1)
    context.fillStyle = '#241f2a'
    context.fillRect(solid.x, solid.y + solid.height - 1, solid.width, 1)
}

function drawPlayer(context: CanvasRenderingContext2D): void {
    const x = Math.round(player.x)
    const y = Math.round(player.y)

    context.fillStyle = '#c89143'
    context.fillRect(x + 1, y + 11, 2, 3)
    context.fillRect(x + 5, y + 11, 2, 3)
    context.fillStyle = '#f4c45f'
    context.fillRect(x, y + 3, player.width, 9)
    context.fillStyle = '#fff4b5'
    context.fillRect(x + (player.facing > 0 ? 5 : 1), y + 5, 2, 2)
    context.fillStyle = '#8f5d34'
    context.fillRect(x + (player.facing > 0 ? 1 : 5), y + 8, 2, 3)
}

function drawLighting(context: CanvasRenderingContext2D, lightPolygon: RayHit[], origin: Vec2): void {
    if (lightPolygon.length === 0) {
        return
    }

    context.save()
    context.fillStyle = 'rgba(4, 4, 9, 0.86)'
    context.fillRect(0, 0, world.width, world.height)
    context.globalCompositeOperation = 'destination-out'
    drawLightPath(context, lightPolygon)

    const gradient = context.createRadialGradient(origin.x, origin.y, 3, origin.x, origin.y, player.lightRadius)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    gradient.addColorStop(0.62, 'rgba(255, 255, 255, 0.42)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fill()
    context.restore()

    context.save()
    context.globalCompositeOperation = 'lighter'
    drawLightPath(context, lightPolygon)
    context.clip()

    const glow = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, player.lightRadius)
    glow.addColorStop(0, 'rgba(244, 196, 95, 0.22)')
    glow.addColorStop(1, 'rgba(244, 196, 95, 0)')
    context.fillStyle = glow
    context.fillRect(origin.x - player.lightRadius, origin.y - player.lightRadius, player.lightRadius * 2, player.lightRadius * 2)
    context.restore()
}

function drawLightPath(context: CanvasRenderingContext2D, lightPolygon: RayHit[]): void {
    context.beginPath()
    context.moveTo(lightPolygon[0].x, lightPolygon[0].y)

    for (let index = 1; index < lightPolygon.length; index += 1) {
        context.lineTo(lightPolygon[index].x, lightPolygon[index].y)
    }

    context.closePath()
}

function drawLightingDebug(context: CanvasRenderingContext2D, lightPolygon: RayHit[], origin: Vec2): void {
    context.save()
    context.strokeStyle = 'rgba(97, 210, 255, 0.28)'
    context.lineWidth = 1

    for (const hit of lightPolygon) {
        context.beginPath()
        context.moveTo(origin.x, origin.y)
        context.lineTo(hit.x, hit.y)
        context.stroke()
    }

    context.strokeStyle = 'rgba(244, 196, 95, 0.65)'
    context.beginPath()
    context.arc(origin.x, origin.y, player.lightRadius, 0, Math.PI * 2)
    context.stroke()
    context.restore()
}

function drawCollisionDebug(context: CanvasRenderingContext2D): void {
    context.save()
    context.strokeStyle = 'rgba(255, 106, 106, 0.9)'
    context.lineWidth = 1

    for (const solid of world.solids) {
        context.strokeRect(solid.x + 0.5, solid.y + 0.5, solid.width - 1, solid.height - 1)
    }

    const playerRect = getPlayerRect()

    context.strokeStyle = 'rgba(115, 255, 153, 0.9)'
    context.strokeRect(playerRect.x + 0.5, playerRect.y + 0.5, playerRect.width - 1, playerRect.height - 1)
    context.restore()
}

function castLight(origin: Vec2, radius: number): RayHit[] {
    const angles: number[] = []

    for (const segment of occluderSegments) {
        addEndpointAngles(angles, origin, segment.x1, segment.y1)
        addEndpointAngles(angles, origin, segment.x2, segment.y2)
    }

    const hits: RayHit[] = []
    let rayChecks = 0

    for (const angle of angles) {
        let closestHit: RayHit | undefined

        for (const segment of occluderSegments) {
            rayChecks += 1
            const hit = intersectRaySegment(origin, angle, segment)

            if (!hit || hit.distance > radius) {
                continue
            }

            if (!closestHit || hit.distance < closestHit.distance) {
                closestHit = hit
            }
        }

        if (closestHit) {
            hits.push(closestHit)
        } else {
            hits.push({
                x: origin.x + Math.cos(angle) * radius,
                y: origin.y + Math.sin(angle) * radius,
                angle,
                distance: radius,
            })
        }
    }

    diagnostics.rays = angles.length
    diagnostics.rayChecks = rayChecks

    return hits.sort((left, right) => left.angle - right.angle)
}

function addEndpointAngles(angles: number[], origin: Vec2, x: number, y: number): void {
    const angle = Math.atan2(y - origin.y, x - origin.x)

    angles.push(angle - rayAngleOffset, angle, angle + rayAngleOffset)
}

function intersectRaySegment(origin: Vec2, angle: number, segment: Segment): RayHit | undefined {
    const rayDirection = {
        x: Math.cos(angle),
        y: Math.sin(angle),
    }
    const segmentDirection = {
        x: segment.x2 - segment.x1,
        y: segment.y2 - segment.y1,
    }
    const denominator = cross(rayDirection, segmentDirection)

    if (Math.abs(denominator) < 0.000001) {
        return undefined
    }

    const originToSegment = {
        x: segment.x1 - origin.x,
        y: segment.y1 - origin.y,
    }
    const rayDistance = cross(originToSegment, segmentDirection) / denominator
    const segmentDistance = cross(originToSegment, rayDirection) / denominator

    if (rayDistance < 0 || segmentDistance < 0 || segmentDistance > 1) {
        return undefined
    }

    return {
        x: origin.x + rayDirection.x * rayDistance,
        y: origin.y + rayDirection.y * rayDistance,
        angle,
        distance: rayDistance,
    }
}

function buildSegments(rects: Rect[]): Segment[] {
    return rects.flatMap((rect) => [
        { x1: rect.x, y1: rect.y, x2: rect.x + rect.width, y2: rect.y },
        { x1: rect.x + rect.width, y1: rect.y, x2: rect.x + rect.width, y2: rect.y + rect.height },
        { x1: rect.x + rect.width, y1: rect.y + rect.height, x2: rect.x, y2: rect.y + rect.height },
        { x1: rect.x, y1: rect.y + rect.height, x2: rect.x, y2: rect.y },
    ])
}

function getPlayerRect(): Rect {
    return {
        x: player.x,
        y: player.y,
        width: player.width,
        height: player.height,
    }
}

function getLightOrigin(): Vec2 {
    return {
        x: player.x + player.width / 2 + player.facing * 2,
        y: player.y + 6,
    }
}

function rectsIntersect(left: Rect, right: Rect): boolean {
    return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y
}

function playTone(frequency: number, durationSeconds: number, gainValue: number): void {
    if (!audioContext || !soundEnabled) {
        return
    }

    const now = audioContext.currentTime
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(frequency, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + durationSeconds)
}

function updateSoundButton(): void {
    soundToggle.textContent = soundEnabled ? 'Sound enabled' : 'Enable sound'
    soundToggle.setAttribute('aria-pressed', String(soundEnabled))
}

function updateMetrics(): void {
    const now = performance.now()

    if (now < nextMetricsUpdate) {
        return
    }

    nextMetricsUpdate = now + 120
    fpsMetric.textContent = diagnostics.fps.toFixed(0)
    frameMetric.textContent = `${diagnostics.frameMs.toFixed(2)}ms`
    updateMetric.textContent = `${diagnostics.updateMs.toFixed(2)}ms`
    renderMetric.textContent = `${diagnostics.renderMs.toFixed(2)}ms`
    rayTimeMetric.textContent = `${diagnostics.rayMs.toFixed(2)}ms`
    raysMetric.textContent = String(diagnostics.rays)
    checksMetric.textContent = String(diagnostics.rayChecks)
    memoryMetric.textContent = formatMemory()
    groundedMetric.textContent = String(player.grounded)
    velocityMetric.textContent = `${player.vx.toFixed(1)}, ${player.vy.toFixed(1)}`
}

function formatMemory(): string {
    const memory = (performance as MemoryPerformance).memory

    if (!memory) {
        return 'n/a'
    }

    return `${toMegabytes(memory.usedJSHeapSize)} / ${toMegabytes(memory.jsHeapSizeLimit)} MB`
}

function toMegabytes(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(1)
}

function approach(current: number, target: number, amount: number): number {
    if (current < target) {
        return Math.min(current + amount, target)
    }

    return Math.max(current - amount, target)
}

function smooth(current: number, next: number, strength: number): number {
    if (current === 0) {
        return next
    }

    return current + (next - current) * strength
}

function cross(left: Vec2, right: Vec2): number {
    return left.x * right.y - left.y * right.x
}
