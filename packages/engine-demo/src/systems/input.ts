const movementKeys = new Set(['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' '])
const jumpKeys = new Set(['arrowup', 'w', ' '])

export type PlayerInputFrame = {
    horizontal: number
    jumpQueued: boolean
    jumpHeld: boolean
    downHeld: boolean
}

export class GameInput {
    private readonly blockedRoot: HTMLElement
    private readonly pressedKeys = new Set<string>()
    private jumpQueued = false

    constructor(blockedRoot: HTMLElement) {
        this.blockedRoot = blockedRoot
    }

    start(): void {
        window.addEventListener('keydown', this.handleKeyDown)
        window.addEventListener('keyup', this.handleKeyUp)
    }

    readPlayerFrame(): PlayerInputFrame {
        const horizontal = Number(this.pressedKeys.has('arrowright') || this.pressedKeys.has('d')) - Number(this.pressedKeys.has('arrowleft') || this.pressedKeys.has('a'))
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

    private readonly handleKeyDown = (event: KeyboardEvent): void => {
        if (!this.shouldUseGameInput(event)) {
            return
        }

        const key = event.key.toLowerCase()

        if (movementKeys.has(key)) {
            event.preventDefault()
        }

        this.pressedKeys.add(key)

        if (jumpKeys.has(key) && !event.repeat) {
            this.jumpQueued = true
        }
    }

    private readonly handleKeyUp = (event: KeyboardEvent): void => {
        if (!this.shouldUseGameInput(event)) {
            this.pressedKeys.delete(event.key.toLowerCase())
            return
        }

        this.pressedKeys.delete(event.key.toLowerCase())
    }

    private shouldUseGameInput(event: KeyboardEvent): boolean {
        return !(event.target instanceof Node && this.blockedRoot.contains(event.target))
    }
}
