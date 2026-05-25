export type PlayerInputFrame = {
    horizontal: number
    jumpQueued: boolean
    jumpHeld: boolean
    downHeld: boolean
}

export type KeyboardInputEvent = {
    readonly key: string
    readonly repeat?: boolean
    readonly target?: EventTarget | null
    preventDefault?(): void
}

export type KeyboardInputSource = {
    addEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardInputEvent) => void): void
    removeEventListener(type: 'keydown' | 'keyup', listener: (event: KeyboardInputEvent) => void): void
}

export type InputBlocker = {
    contains(target: EventTarget | null | undefined): boolean
}

export type InputManagerOptions = {
    readonly source: KeyboardInputSource
    readonly blockedBy?: InputBlocker
    readonly movementKeys?: ReadonlySet<string>
    readonly jumpKeys?: ReadonlySet<string>
}

const defaultMovementKeys = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '])
const defaultJumpKeys = new Set(['arrowup', 'w', ' '])

export class InputManager {
    private readonly source: KeyboardInputSource
    private readonly blockedBy: InputBlocker | undefined
    private readonly movementKeys: ReadonlySet<string>
    private readonly jumpKeys: ReadonlySet<string>
    private readonly pressedKeys = new Set<string>()
    private jumpQueued = false
    private active = false

    constructor(options: InputManagerOptions) {
        this.source = options.source
        this.blockedBy = options.blockedBy
        this.movementKeys = options.movementKeys ?? defaultMovementKeys
        this.jumpKeys = options.jumpKeys ?? defaultJumpKeys
    }

    start(): void {
        if (this.active) {
            return
        }

        this.source.addEventListener('keydown', this.handleKeyDown)
        this.source.addEventListener('keyup', this.handleKeyUp)
        this.active = true
    }

    stop(): void {
        if (!this.active) {
            return
        }

        this.source.removeEventListener('keydown', this.handleKeyDown)
        this.source.removeEventListener('keyup', this.handleKeyUp)
        this.pressedKeys.clear()
        this.jumpQueued = false
        this.active = false
    }

    readPlayerFrame(): PlayerInputFrame {
        const horizontal = Number(this.pressedKeys.has('arrowright') || this.pressedKeys.has('d')) -
            Number(this.pressedKeys.has('arrowleft') || this.pressedKeys.has('a'))
        const jumpQueued = this.jumpQueued
        const jumpHeld = this.pressedKeys.has('arrowup') || this.pressedKeys.has('w') || this.pressedKeys.has(' ')
        const downHeld = this.pressedKeys.has('arrowdown') || this.pressedKeys.has('s')

        this.jumpQueued = false

        return {
            horizontal,
            jumpQueued,
            jumpHeld,
            downHeld,
        }
    }

    isPressed(key: string): boolean {
        return this.pressedKeys.has(key.toLowerCase())
    }

    private readonly handleKeyDown = (event: KeyboardInputEvent): void => {
        if (!this.shouldUseGameInput(event)) {
            return
        }

        const key = event.key.toLowerCase()

        if (this.movementKeys.has(key)) {
            event.preventDefault?.()
        }

        this.pressedKeys.add(key)

        if (this.jumpKeys.has(key) && !event.repeat) {
            this.jumpQueued = true
        }
    }

    private readonly handleKeyUp = (event: KeyboardInputEvent): void => {
        this.pressedKeys.delete(event.key.toLowerCase())
    }

    private shouldUseGameInput(event: KeyboardInputEvent): boolean {
        return !this.blockedBy?.contains(event.target)
    }
}
