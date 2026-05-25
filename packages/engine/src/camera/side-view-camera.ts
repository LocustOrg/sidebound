import { clamp, type Rect, smoothDamp, type Vec2 } from '../core/mod.ts'

export type CameraTarget = {
    x: number
    y: number
    width: number
    height: number
    vx: number
    vy: number
    facing: number
}

export type CameraBounds = {
    width: number
    height: number
}

export type SideViewCameraSettings = {
    horizontalDeadZone: number
    verticalDeadZone: number
    idleLookAheadDistance: number
    movingLookAheadDistance: number
    lookAheadResponse: number
    focusHeightRatio: number
    anchorHeightRatio: number
    smoothTimeX: number
    smoothTimeY: number
    maxSpeed: number
    recoilMovingSpeed: number
    recoilStoppedSpeed: number
    recoilImpulse: number
    recoilSpring: number
    recoilDamping: number
    maxRecoil: number
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

export const defaultSideViewCameraSettings: SideViewCameraSettings = {
    horizontalDeadZone: 36,
    verticalDeadZone: 20,
    idleLookAheadDistance: 12,
    movingLookAheadDistance: 34,
    lookAheadResponse: 6.5,
    focusHeightRatio: 0.34,
    anchorHeightRatio: 0.64,
    smoothTimeX: 0.22,
    smoothTimeY: 0.32,
    maxSpeed: 420,
    recoilMovingSpeed: 42,
    recoilStoppedSpeed: 8,
    recoilImpulse: 130,
    recoilSpring: 72,
    recoilDamping: 12,
    maxRecoil: 14,
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
    readonly state: CameraState = createCameraState()
    private readonly world: CameraBounds
    private readonly viewport: CameraBounds
    private readonly settings: SideViewCameraSettings

    constructor(world: CameraBounds, viewport: CameraBounds, settings: Partial<SideViewCameraSettings> = {}) {
        this.world = world
        this.viewport = viewport
        this.settings = {
            ...defaultSideViewCameraSettings,
            ...settings,
        }
    }

    snapToTarget(target: CameraTarget): void {
        this.state.lookAhead = target.facing * this.settings.idleLookAheadDistance
        const next = this.getTarget(target)

        this.state.x = next.x
        this.state.y = next.y
        this.state.vx = 0
        this.state.vy = 0
        this.state.recoilX = 0
        this.state.recoilVelocityX = 0
        this.state.lastMoveDirection = target.facing
        this.state.wasMovingFast = false
    }

    snapToPlayer(player: CameraTarget): void {
        this.snapToTarget(player)
    }

    update(deltaSeconds: number, target: CameraTarget): void {
        const speedRatio = clamp(Math.abs(target.vx) / 72, 0, 1)
        const lookAheadDistance = this.settings.idleLookAheadDistance +
            (this.settings.movingLookAheadDistance - this.settings.idleLookAheadDistance) * speedRatio
        const targetLookAhead = target.facing * lookAheadDistance
        const lookAheadSmoothing = 1 - Math.exp(-deltaSeconds * this.settings.lookAheadResponse)

        this.state.lookAhead += (targetLookAhead - this.state.lookAhead) * lookAheadSmoothing
        this.updateRecoil(deltaSeconds, target)

        const nextTarget = this.getTarget(target)
        const recoiledTargetX = clamp(nextTarget.x + this.state.recoilX, 0, Math.max(0, this.world.width - this.viewport.width))
        const nextX = smoothDamp(this.state.x, recoiledTargetX, this.state.vx, this.settings.smoothTimeX, this.settings.maxSpeed, deltaSeconds)
        const nextY = smoothDamp(this.state.y, nextTarget.y, this.state.vy, this.settings.smoothTimeY, this.settings.maxSpeed, deltaSeconds)

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

    worldToViewport(point: Vec2): Vec2 {
        const camera = this.getRect()

        return {
            x: point.x - camera.x,
            y: point.y - camera.y,
        }
    }

    viewportToWorld(point: Vec2): Vec2 {
        const camera = this.getRect()

        return {
            x: point.x + camera.x,
            y: point.y + camera.y,
        }
    }

    private updateRecoil(deltaSeconds: number, target: CameraTarget): void {
        const speed = Math.abs(target.vx)

        if (speed > this.settings.recoilMovingSpeed) {
            this.state.lastMoveDirection = Math.sign(target.vx)
            this.state.wasMovingFast = true
        } else if (this.state.wasMovingFast && speed < this.settings.recoilStoppedSpeed) {
            this.state.recoilVelocityX += this.state.lastMoveDirection * this.settings.recoilImpulse
            this.state.wasMovingFast = false
        }

        const recoilAcceleration = -this.state.recoilX * this.settings.recoilSpring - this.state.recoilVelocityX * this.settings.recoilDamping

        this.state.recoilVelocityX += recoilAcceleration * deltaSeconds
        this.state.recoilX = clamp(this.state.recoilX + this.state.recoilVelocityX * deltaSeconds, -this.settings.maxRecoil, this.settings.maxRecoil)
    }

    private getTarget(target: CameraTarget): Vec2 {
        const focusX = target.x + target.width / 2 + this.state.lookAhead
        const focusY = target.y + target.height * this.settings.focusHeightRatio
        const cameraCenterX = this.state.x + this.viewport.width / 2
        const cameraAnchorY = this.state.y + this.viewport.height * this.settings.anchorHeightRatio
        let targetX = this.state.x
        let targetY = this.state.y

        if (focusX < cameraCenterX - this.settings.horizontalDeadZone) {
            targetX = focusX + this.settings.horizontalDeadZone - this.viewport.width / 2
        } else if (focusX > cameraCenterX + this.settings.horizontalDeadZone) {
            targetX = focusX - this.settings.horizontalDeadZone - this.viewport.width / 2
        }

        if (focusY < cameraAnchorY - this.settings.verticalDeadZone) {
            targetY = focusY + this.settings.verticalDeadZone - this.viewport.height * this.settings.anchorHeightRatio
        } else if (focusY > cameraAnchorY + this.settings.verticalDeadZone) {
            targetY = focusY - this.settings.verticalDeadZone - this.viewport.height * this.settings.anchorHeightRatio
        }

        return {
            x: clamp(targetX, 0, Math.max(0, this.world.width - this.viewport.width)),
            y: clamp(targetY, 0, Math.max(0, this.world.height - this.viewport.height)),
        }
    }
}
