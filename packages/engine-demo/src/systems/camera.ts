import { cameraSettings } from '../core/config'
import { clamp, smoothDamp, type Rect, type Vec2 } from '../core/geometry'

/** Minimal interface the camera needs from any tracked entity */
export type CameraTarget = {
    x: number
    y: number
    width: number
    height: number
    vx: number
    vy: number
    facing: number
}

export type CameraState = {
    x: number
    y: number
    vx: number
    vy: number
    lookAhead: number
    recoilX: number
    recoilVelocityX: number
    lastMoveDirection: number
    wasMovingFast: boolean
}

type CameraBounds = {
    width: number
    height: number
}

function createCameraState(): CameraState {
    return {
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
}

export class SideViewCamera {
    readonly state = createCameraState()
    private readonly world: CameraBounds
    private readonly viewport: CameraBounds

    constructor(world: CameraBounds, viewport: CameraBounds) {
        this.world = world
        this.viewport = viewport
    }

    snapToPlayer(player: CameraTarget): void {
        this.state.lookAhead = player.facing * cameraSettings.lookAheadDistance
        const target = this.getTarget(player)

        this.state.x = target.x
        this.state.y = target.y
        this.state.vx = 0
        this.state.vy = 0
        this.state.recoilX = 0
        this.state.recoilVelocityX = 0
        this.state.lastMoveDirection = player.facing
        this.state.wasMovingFast = false
    }

    update(deltaSeconds: number, player: CameraTarget): void {
        const targetLookAhead = Math.abs(player.vx) > 8 ? player.facing * cameraSettings.lookAheadDistance : 0
        const lookAheadSmoothing = 1 - Math.exp(-deltaSeconds * cameraSettings.lookAheadResponse)

        this.state.lookAhead += (targetLookAhead - this.state.lookAhead) * lookAheadSmoothing
        this.updateRecoil(deltaSeconds, player)

        const target = this.getTarget(player)
        const recoiledTargetX = clamp(target.x + this.state.recoilX, 0, Math.max(0, this.world.width - this.viewport.width))
        const nextX = smoothDamp(this.state.x, recoiledTargetX, this.state.vx, cameraSettings.smoothTimeX, cameraSettings.maxSpeed, deltaSeconds)
        const nextY = smoothDamp(this.state.y, target.y, this.state.vy, cameraSettings.smoothTimeY, cameraSettings.maxSpeed, deltaSeconds)

        this.state.x = nextX.value
        this.state.y = nextY.value
        this.state.vx = nextX.velocity
        this.state.vy = nextY.velocity
    }

    getRect(): Rect {
        return {
            x: Math.round(this.state.x),
            y: Math.round(this.state.y),
            width: this.viewport.width,
            height: this.viewport.height,
        }
    }

    private updateRecoil(deltaSeconds: number, player: CameraTarget): void {
        const speed = Math.abs(player.vx)

        if (speed > cameraSettings.recoilMovingSpeed) {
            this.state.lastMoveDirection = Math.sign(player.vx)
            this.state.wasMovingFast = true
        } else if (this.state.wasMovingFast && speed < cameraSettings.recoilStoppedSpeed) {
            this.state.recoilVelocityX += this.state.lastMoveDirection * cameraSettings.recoilImpulse
            this.state.wasMovingFast = false
        }

        const recoilAcceleration = -this.state.recoilX * cameraSettings.recoilSpring - this.state.recoilVelocityX * cameraSettings.recoilDamping

        this.state.recoilVelocityX += recoilAcceleration * deltaSeconds
        this.state.recoilX = clamp(this.state.recoilX + this.state.recoilVelocityX * deltaSeconds, -cameraSettings.maxRecoil, cameraSettings.maxRecoil)
    }

    private getTarget(player: CameraTarget): Vec2 {
        const focusX = player.x + player.width / 2 + this.state.lookAhead
        const focusY = player.y + player.height / 2
        const cameraCenterX = this.state.x + this.viewport.width / 2
        const cameraAnchorY = this.state.y + this.viewport.height * 0.58
        let targetX = this.state.x
        let targetY = this.state.y

        if (focusX < cameraCenterX - cameraSettings.horizontalDeadZone) {
            targetX = focusX + cameraSettings.horizontalDeadZone - this.viewport.width / 2
        } else if (focusX > cameraCenterX + cameraSettings.horizontalDeadZone) {
            targetX = focusX - cameraSettings.horizontalDeadZone - this.viewport.width / 2
        }

        if (focusY < cameraAnchorY - cameraSettings.verticalDeadZone) {
            targetY = focusY + cameraSettings.verticalDeadZone - this.viewport.height * 0.58
        } else if (focusY > cameraAnchorY + cameraSettings.verticalDeadZone) {
            targetY = focusY - cameraSettings.verticalDeadZone - this.viewport.height * 0.58
        }

        return {
            x: clamp(targetX, 0, Math.max(0, this.world.width - this.viewport.width)),
            y: clamp(targetY, 0, Math.max(0, this.world.height - this.viewport.height)),
        }
    }
}
