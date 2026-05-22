import { PixelEngine } from '@strange-path/engine'
import { type Rect, type Vec2, viewport, world } from './demo-map'
import './style.css'

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

type DebugWindowSettings = {
    panelLeft?: number
    panelTop?: number
    showLighting?: boolean
    showCollision?: boolean
    soundPreferred?: boolean
}

const controls = {
    maxSpeed: 78,
    groundAcceleration: 780,
    airAcceleration: 430,
    friction: 920,
    gravity: 420,
    jumpVelocity: 176,
}

const cameraSettings = {
    horizontalDeadZone: 42,
    verticalDeadZone: 24,
    lookAheadDistance: 30,
    lookAheadResponse: 5,
    smoothTimeX: 0.28,
    smoothTimeY: 0.38,
    maxSpeed: 420,
    recoilMovingSpeed: 42,
    recoilStoppedSpeed: 8,
    recoilImpulse: 130,
    recoilSpring: 72,
    recoilDamping: 12,
    maxRecoil: 14,
}

const movementKeys = new Set(['arrowup', 'arrowleft', 'arrowright', 'w', 'a', 'd', ' '])
const pressedKeys = new Set<string>()
const jumpKeys = new Set(['arrowup', 'w', ' '])
const rayAngleOffset = 0.00045
const rayAnglePrecision = 100_000
const radialRaySamples = 128
const fullCircleRadians = Math.PI * 2
const panelMargin = 12
const panelKeyboardStep = 16
const debugWindowStorageKey = 'strange-path.engine-demo.debug-window'

const canvas = requireElement<HTMLCanvasElement>('#game')
const stage = requireElement<HTMLElement>('.stage')
const debugPanel = requireElement<HTMLElement>('#debug-panel')
const debugPanelHandle = requireElement<HTMLElement>('#debug-panel-handle')
const debugPanelReset = requireElement<HTMLButtonElement>('#debug-panel-reset')
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
const savedDebugWindowSettings = readDebugWindowSettings()

if (savedDebugWindowSettings.showLighting !== undefined) {
    lightingToggle.checked = savedDebugWindowSettings.showLighting
}

if (savedDebugWindowSettings.showCollision !== undefined) {
    collisionToggle.checked = savedDebugWindowSettings.showCollision
}

const player = {
    x: world.spawn.x,
    y: world.spawn.y,
    width: 5,
    height: 10,
    vx: 0,
    vy: 0,
    grounded: false,
    facing: 1,
    lightRadius: 88,
}

const camera = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    lookAhead: 0,
    recoilX: 0,
    recoilVelocityX: 0,
    lastMoveDirection: 1,
    wasMovingFast: false,
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
let soundPreferred = savedDebugWindowSettings.soundPreferred ?? false
let jumpQueued = false
let stepCooldown = 0
let nextMetricsUpdate = 0
let panelDrag:
    | {
          pointerId: number
          offsetX: number
          offsetY: number
      }
    | undefined

initializeDebugPanelWindow()
snapCameraToPlayer()

window.addEventListener('keydown', (event) => {
    if (!shouldUseGameInput(event)) {
        return
    }

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
    if (!shouldUseGameInput(event)) {
        pressedKeys.delete(event.key.toLowerCase())
        return
    }

    pressedKeys.delete(event.key.toLowerCase())
})

soundToggle.addEventListener('click', async () => {
    if (!audioContext) {
        audioContext = new AudioContext()
    }

    if (soundEnabled) {
        soundEnabled = false
        soundPreferred = false
        saveDebugWindowSettings({
            soundPreferred,
        })
        updateSoundButton()
        return
    }

    await audioContext.resume()
    soundEnabled = true
    soundPreferred = true
    saveDebugWindowSettings({
        soundPreferred,
    })
    playTone(196, 0.08, 0.035)
    updateSoundButton()
})

lightingToggle.addEventListener('change', () => {
    diagnostics.showLighting = lightingToggle.checked
    saveDebugWindowSettings({
        showLighting: lightingToggle.checked,
    })
})

collisionToggle.addEventListener('change', () => {
    diagnostics.showCollision = collisionToggle.checked
    saveDebugWindowSettings({
        showCollision: collisionToggle.checked,
    })
})

function initializeDebugPanelWindow(): void {
    if (savedDebugWindowSettings.panelLeft !== undefined && savedDebugWindowSettings.panelTop !== undefined) {
        setDebugPanelPosition(savedDebugWindowSettings.panelLeft, savedDebugWindowSettings.panelTop)
    } else {
        resetDebugPanelPosition()
    }

    window.addEventListener('resize', keepDebugPanelInViewport)
    window.addEventListener('pointermove', moveDebugPanelDrag)
    window.addEventListener('pointerup', stopDebugPanelDrag)
    window.addEventListener('pointercancel', stopDebugPanelDrag)
    debugPanelHandle.addEventListener('pointerdown', startDebugPanelDrag)
    debugPanelHandle.addEventListener('keydown', moveDebugPanelWithKeyboard)
    debugPanelReset.addEventListener('click', resetDebugPanelPosition)
}

function startDebugPanelDrag(event: PointerEvent): void {
    if (event.button !== 0) {
        return
    }

    const rect = debugPanel.getBoundingClientRect()

    panelDrag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
    }
    debugPanel.classList.add('is-dragging')
    debugPanelHandle.setPointerCapture(event.pointerId)
    event.preventDefault()
}

function moveDebugPanelDrag(event: PointerEvent): void {
    if (!panelDrag || event.pointerId !== panelDrag.pointerId) {
        return
    }

    setDebugPanelPosition(event.clientX - panelDrag.offsetX, event.clientY - panelDrag.offsetY)
}

function stopDebugPanelDrag(event: PointerEvent): void {
    if (!panelDrag || event.pointerId !== panelDrag.pointerId) {
        return
    }

    panelDrag = undefined
    debugPanel.classList.remove('is-dragging')

    if (debugPanelHandle.hasPointerCapture(event.pointerId)) {
        debugPanelHandle.releasePointerCapture(event.pointerId)
    }
}

function moveDebugPanelWithKeyboard(event: KeyboardEvent): void {
    const rect = debugPanel.getBoundingClientRect()
    const step = event.shiftKey ? panelKeyboardStep * 3 : panelKeyboardStep
    let nextX = rect.left
    let nextY = rect.top

    if (event.key === 'ArrowLeft') {
        nextX -= step
    } else if (event.key === 'ArrowRight') {
        nextX += step
    } else if (event.key === 'ArrowUp') {
        nextY -= step
    } else if (event.key === 'ArrowDown') {
        nextY += step
    } else if (event.key === 'Home') {
        resetDebugPanelPosition()
        event.preventDefault()
        event.stopPropagation()
        return
    } else {
        return
    }

    setDebugPanelPosition(nextX, nextY)
    event.preventDefault()
    event.stopPropagation()
}

function resetDebugPanelPosition(): void {
    const stageRect = stage.getBoundingClientRect()
    const panelRect = debugPanel.getBoundingClientRect()
    const left = Math.min(stageRect.right - panelRect.width - 16, window.innerWidth - panelRect.width - panelMargin)
    const top = Math.max(stageRect.top + 16, panelMargin)

    setDebugPanelPosition(left, top)
}

function keepDebugPanelInViewport(): void {
    const rect = debugPanel.getBoundingClientRect()

    setDebugPanelPosition(rect.left, rect.top)
}

function setDebugPanelPosition(left: number, top: number): void {
    const rect = debugPanel.getBoundingClientRect()
    const maxLeft = Math.max(panelMargin, window.innerWidth - rect.width - panelMargin)
    const maxTop = Math.max(panelMargin, window.innerHeight - rect.height - panelMargin)

    debugPanel.style.left = `${clamp(left, panelMargin, maxLeft)}px`
    debugPanel.style.top = `${clamp(top, panelMargin, maxTop)}px`
    debugPanel.style.right = 'auto'
    debugPanel.style.bottom = 'auto'

    saveDebugWindowSettings({
        panelLeft: Number.parseFloat(debugPanel.style.left),
        panelTop: Number.parseFloat(debugPanel.style.top),
    })
}

function shouldUseGameInput(event: KeyboardEvent): boolean {
    return !(event.target instanceof Node && debugPanel.contains(event.target))
}

function readDebugWindowSettings(): DebugWindowSettings {
    try {
        const value = window.localStorage.getItem(debugWindowStorageKey)

        if (!value) {
            return {}
        }

        const parsed = JSON.parse(value) as DebugWindowSettings

        return {
            panelLeft: typeof parsed.panelLeft === 'number' ? parsed.panelLeft : undefined,
            panelTop: typeof parsed.panelTop === 'number' ? parsed.panelTop : undefined,
            showLighting: typeof parsed.showLighting === 'boolean' ? parsed.showLighting : undefined,
            showCollision: typeof parsed.showCollision === 'boolean' ? parsed.showCollision : undefined,
            soundPreferred: typeof parsed.soundPreferred === 'boolean' ? parsed.soundPreferred : undefined,
        }
    } catch {
        return {}
    }
}

function saveDebugWindowSettings(nextSettings: DebugWindowSettings): void {
    try {
        const currentSettings = readDebugWindowSettings()

        window.localStorage.setItem(
            debugWindowStorageKey,
            JSON.stringify({
                ...currentSettings,
                ...nextSettings,
            }),
        )
    } catch {
        // Debug preferences are convenient, not required for the demo to run.
    }
}

const engine = new PixelEngine({
    canvas,
    width: viewport.width,
    height: viewport.height,
    scale: 'css',
    background: '#111019',
    loop: {
        update(deltaSeconds) {
            const updateStart = performance.now()
            const safeDeltaSeconds = Math.min(deltaSeconds, 0.05)

            diagnostics.frameMs = smooth(diagnostics.frameMs, deltaSeconds * 1000, 0.12)
            diagnostics.fps = smooth(diagnostics.fps, 1 / Math.max(deltaSeconds, 0.0001), 0.12)
            updatePlayer(safeDeltaSeconds)
            updateCamera(safeDeltaSeconds)

            diagnostics.updateMs = performance.now() - updateStart
        },
        render(context) {
            const renderStart = performance.now()
            const cameraRect = getCameraRect()

            context.save()
            context.translate(-cameraRect.x, -cameraRect.y)
            drawArea(context)
            drawPlayer(context)

            const rayStart = performance.now()
            const lightOrigin = getLightOrigin()
            const lightPolygon = castLight(lightOrigin, player.lightRadius)
            diagnostics.rayMs = performance.now() - rayStart

            drawLighting(context, lightPolygon, lightOrigin, cameraRect)

            if (diagnostics.showLighting) {
                drawLightingDebug(context, lightPolygon, lightOrigin)
            }

            if (diagnostics.showCollision) {
                drawCollisionDebug(context)
            }
            context.restore()

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

function snapCameraToPlayer(): void {
    camera.lookAhead = player.facing * cameraSettings.lookAheadDistance
    const target = getCameraTarget()

    camera.x = target.x
    camera.y = target.y
    camera.vx = 0
    camera.vy = 0
    camera.recoilX = 0
    camera.recoilVelocityX = 0
    camera.lastMoveDirection = player.facing
    camera.wasMovingFast = false
}

function updateCamera(deltaSeconds: number): void {
    const targetLookAhead = Math.abs(player.vx) > 8 ? player.facing * cameraSettings.lookAheadDistance : 0
    const lookAheadSmoothing = 1 - Math.exp(-deltaSeconds * cameraSettings.lookAheadResponse)

    camera.lookAhead += (targetLookAhead - camera.lookAhead) * lookAheadSmoothing
    updateCameraRecoil(deltaSeconds)

    const target = getCameraTarget()
    const recoiledTargetX = clamp(target.x + camera.recoilX, 0, Math.max(0, world.width - viewport.width))
    const nextX = smoothDamp(camera.x, recoiledTargetX, camera.vx, cameraSettings.smoothTimeX, cameraSettings.maxSpeed, deltaSeconds)
    const nextY = smoothDamp(camera.y, target.y, camera.vy, cameraSettings.smoothTimeY, cameraSettings.maxSpeed, deltaSeconds)

    camera.x = nextX.value
    camera.y = nextY.value
    camera.vx = nextX.velocity
    camera.vy = nextY.velocity
}

function updateCameraRecoil(deltaSeconds: number): void {
    const speed = Math.abs(player.vx)

    if (speed > cameraSettings.recoilMovingSpeed) {
        camera.lastMoveDirection = Math.sign(player.vx)
        camera.wasMovingFast = true
    } else if (camera.wasMovingFast && speed < cameraSettings.recoilStoppedSpeed) {
        camera.recoilVelocityX += camera.lastMoveDirection * cameraSettings.recoilImpulse
        camera.wasMovingFast = false
    }

    const recoilAcceleration = -camera.recoilX * cameraSettings.recoilSpring - camera.recoilVelocityX * cameraSettings.recoilDamping

    camera.recoilVelocityX += recoilAcceleration * deltaSeconds
    camera.recoilX = clamp(camera.recoilX + camera.recoilVelocityX * deltaSeconds, -cameraSettings.maxRecoil, cameraSettings.maxRecoil)
}

function getCameraTarget(): Vec2 {
    const focusX = player.x + player.width / 2 + camera.lookAhead
    const focusY = player.y + player.height / 2
    const cameraCenterX = camera.x + viewport.width / 2
    const cameraAnchorY = camera.y + viewport.height * 0.58
    let targetX = camera.x
    let targetY = camera.y

    if (focusX < cameraCenterX - cameraSettings.horizontalDeadZone) {
        targetX = focusX + cameraSettings.horizontalDeadZone - viewport.width / 2
    } else if (focusX > cameraCenterX + cameraSettings.horizontalDeadZone) {
        targetX = focusX - cameraSettings.horizontalDeadZone - viewport.width / 2
    }

    if (focusY < cameraAnchorY - cameraSettings.verticalDeadZone) {
        targetY = focusY + cameraSettings.verticalDeadZone - viewport.height * 0.58
    } else if (focusY > cameraAnchorY + cameraSettings.verticalDeadZone) {
        targetY = focusY - cameraSettings.verticalDeadZone - viewport.height * 0.58
    }

    return {
        x: clamp(targetX, 0, Math.max(0, world.width - viewport.width)),
        y: clamp(targetY, 0, Math.max(0, world.height - viewport.height)),
    }
}

function getCameraRect(): Rect {
    return {
        x: Math.round(camera.x),
        y: Math.round(camera.y),
        width: viewport.width,
        height: viewport.height,
    }
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
    const eyeX = player.facing > 0 ? x + 3 : x + 1

    context.fillStyle = '#c89143'
    context.fillRect(x + 1, y + 8, 1, 2)
    context.fillRect(x + 3, y + 8, 1, 2)
    context.fillStyle = '#f4c45f'
    context.fillRect(x, y + 2, player.width, 7)
    context.fillStyle = '#fff4b5'
    context.fillRect(eyeX, y + 4, 1, 1)
    context.fillStyle = '#8f5d34'
    context.fillRect(x + (player.facing > 0 ? 1 : 3), y + 6, 1, 2)
}

function drawLighting(context: CanvasRenderingContext2D, lightPolygon: RayHit[], origin: Vec2, cameraRect: Rect): void {
    if (lightPolygon.length === 0) {
        return
    }

    context.save()
    context.fillStyle = 'rgba(4, 4, 9, 0.86)'
    context.fillRect(cameraRect.x, cameraRect.y, cameraRect.width, cameraRect.height)
    context.globalCompositeOperation = 'destination-out'

    const gradient = context.createRadialGradient(origin.x, origin.y, 3, origin.x, origin.y, player.lightRadius)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    gradient.addColorStop(0.62, 'rgba(255, 255, 255, 0.42)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    drawLightWedges(context, lightPolygon, origin)
    context.restore()

    context.save()
    context.globalCompositeOperation = 'lighter'

    const glow = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, player.lightRadius)
    glow.addColorStop(0, 'rgba(244, 196, 95, 0.22)')
    glow.addColorStop(1, 'rgba(244, 196, 95, 0)')
    context.fillStyle = glow
    drawLightWedges(context, lightPolygon, origin)
    context.restore()
}

function drawLightWedges(context: CanvasRenderingContext2D, lightPolygon: RayHit[], origin: Vec2): void {
    if (lightPolygon.length < 2) {
        return
    }

    for (let index = 0; index < lightPolygon.length; index += 1) {
        const nextIndex = (index + 1) % lightPolygon.length
        const current = lightPolygon[index]
        const next = lightPolygon[nextIndex]

        context.beginPath()
        context.moveTo(origin.x, origin.y)
        context.lineTo(current.x, current.y)
        context.lineTo(next.x, next.y)
        context.closePath()
        context.fill()
    }
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
    const activeSegments = occluderSegments.filter((segment) => segmentTouchesCircle(segment, origin, radius))
    const angleKeys = new Set<number>()
    const angles: number[] = []

    for (let index = 0; index < radialRaySamples; index += 1) {
        addRayAngle(angles, angleKeys, (index / radialRaySamples) * fullCircleRadians)
    }

    for (const segment of activeSegments) {
        addEndpointAngles(angles, angleKeys, origin, segment.x1, segment.y1)
        addEndpointAngles(angles, angleKeys, origin, segment.x2, segment.y2)
    }

    const hits: RayHit[] = []
    let rayChecks = 0

    for (const angle of angles) {
        let closestHit: RayHit | undefined

        for (const segment of activeSegments) {
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

function addEndpointAngles(angles: number[], angleKeys: Set<number>, origin: Vec2, x: number, y: number): void {
    const angle = Math.atan2(y - origin.y, x - origin.x)

    addRayAngle(angles, angleKeys, angle - rayAngleOffset)
    addRayAngle(angles, angleKeys, angle)
    addRayAngle(angles, angleKeys, angle + rayAngleOffset)
}

function addRayAngle(angles: number[], angleKeys: Set<number> | undefined, angle: number): void {
    const normalizedAngle = normalizeAngle(angle)
    const key = Math.round(normalizedAngle * rayAnglePrecision)

    if (angleKeys?.has(key)) {
        return
    }

    angleKeys?.add(key)
    angles.push(normalizedAngle)
}

function normalizeAngle(angle: number): number {
    return ((angle % fullCircleRadians) + fullCircleRadians) % fullCircleRadians
}

function segmentTouchesCircle(segment: Segment, origin: Vec2, radius: number): boolean {
    return distanceSquaredToSegment(origin, segment) <= radius * radius
}

function distanceSquaredToSegment(point: Vec2, segment: Segment): number {
    const segmentX = segment.x2 - segment.x1
    const segmentY = segment.y2 - segment.y1
    const lengthSquared = segmentX * segmentX + segmentY * segmentY

    if (lengthSquared === 0) {
        const dx = point.x - segment.x1
        const dy = point.y - segment.y1

        return dx * dx + dy * dy
    }

    const t = clamp(((point.x - segment.x1) * segmentX + (point.y - segment.y1) * segmentY) / lengthSquared, 0, 1)
    const closestX = segment.x1 + t * segmentX
    const closestY = segment.y1 + t * segmentY
    const dx = point.x - closestX
    const dy = point.y - closestY

    return dx * dx + dy * dy
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
    if (soundEnabled) {
        soundToggle.textContent = 'Sound enabled'
    } else if (soundPreferred) {
        soundToggle.textContent = 'Enable saved sound'
    } else {
        soundToggle.textContent = 'Enable sound'
    }

    soundToggle.setAttribute('aria-pressed', String(soundPreferred))
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

function smoothDamp(
    current: number,
    target: number,
    velocity: number,
    smoothTime: number,
    maxSpeed: number,
    deltaSeconds: number,
): {
    value: number
    velocity: number
} {
    const safeSmoothTime = Math.max(0.0001, smoothTime)
    const omega = 2 / safeSmoothTime
    const x = omega * deltaSeconds
    const exponential = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
    const originalTarget = target
    const maxChange = maxSpeed * safeSmoothTime
    const change = clamp(current - target, -maxChange, maxChange)
    const adjustedTarget = current - change
    const temporaryVelocity = (velocity + omega * change) * deltaSeconds
    let nextVelocity = (velocity - omega * temporaryVelocity) * exponential
    let nextValue = adjustedTarget + (change + temporaryVelocity) * exponential

    if (originalTarget - current > 0 === nextValue > originalTarget) {
        nextValue = originalTarget
        nextVelocity = 0
    }

    return {
        value: nextValue,
        velocity: nextVelocity,
    }
}

function cross(left: Vec2, right: Vec2): number {
    return left.x * right.y - left.y * right.x
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
}
