import type { SoundButtonState } from '../systems/audio'
import { requireElement } from '../core/dom'
import { clamp, type Vec2 } from '@strange-path/engine'

export type DebugWindowSettings = {
    panelLeft?: number
    panelTop?: number
    showLighting?: boolean
    showCollision?: boolean
    soundPreferred?: boolean
}

export type DiagnosticsMetrics = {
    fps: number
    frameMs: number
    updateMs: number
    renderMs: number
    rayMs: number
    rays: number
    rayChecks: number
    grounded: boolean
    velocity: Vec2
    activeSuns: number
    totalSuns: number
    mapSize: string
    solids: number
    reflectors: number
}

type MemoryPerformance = Performance & {
    memory?: {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
    }
}

type DebugPanelElements = {
    stage: HTMLElement
    panel: HTMLElement
    handle: HTMLElement
    reset: HTMLButtonElement
    soundToggle: HTMLButtonElement
    pauseToggle: HTMLButtonElement
    lightingToggle: HTMLInputElement
    collisionToggle: HTMLInputElement
    noclipToggle: HTMLInputElement
    fpsMetric: HTMLElement
    frameMetric: HTMLElement
    updateMetric: HTMLElement
    renderMetric: HTMLElement
    rayTimeMetric: HTMLElement
    raysMetric: HTMLElement
    checksMetric: HTMLElement
    memoryMetric: HTMLElement
    groundedMetric: HTMLElement
    velocityMetric: HTMLElement
    mapSizeMetric: HTMLElement
    solidsMetric: HTMLElement
    reflectorsMetric: HTMLElement
    sunsMetric: HTMLElement
}

type PanelDrag = {
    pointerId: number
    offsetX: number
    offsetY: number
}

type SoundToggleHandler = () => Promise<SoundButtonState> | SoundButtonState

const panelMargin = 12
const panelKeyboardStep = 16
const debugWindowStorageKey = 'strange-path.game.debug-window'

function createDebugPanelElements(): DebugPanelElements {
    return {
        stage: requireElement<HTMLElement>('.stage'),
        panel: requireElement<HTMLElement>('#debug-panel'),
        handle: requireElement<HTMLElement>('#debug-panel-handle'),
        reset: requireElement<HTMLButtonElement>('#debug-panel-reset'),
        soundToggle: requireElement<HTMLButtonElement>('#sound-toggle'),
        pauseToggle: requireElement<HTMLButtonElement>('#pause-toggle'),
        lightingToggle: requireElement<HTMLInputElement>('#debug-lighting'),
        collisionToggle: requireElement<HTMLInputElement>('#debug-collision'),
        noclipToggle: requireElement<HTMLInputElement>('#debug-noclip'),
        fpsMetric: requireElement<HTMLElement>('#metric-fps'),
        frameMetric: requireElement<HTMLElement>('#metric-frame'),
        updateMetric: requireElement<HTMLElement>('#metric-update'),
        renderMetric: requireElement<HTMLElement>('#metric-render'),
        rayTimeMetric: requireElement<HTMLElement>('#metric-ray-time'),
        raysMetric: requireElement<HTMLElement>('#metric-rays'),
        checksMetric: requireElement<HTMLElement>('#metric-checks'),
        memoryMetric: requireElement<HTMLElement>('#metric-memory'),
        groundedMetric: requireElement<HTMLElement>('#metric-grounded'),
        velocityMetric: requireElement<HTMLElement>('#metric-velocity'),
        mapSizeMetric: requireElement<HTMLElement>('#metric-map-size'),
        solidsMetric: requireElement<HTMLElement>('#metric-solids'),
        reflectorsMetric: requireElement<HTMLElement>('#metric-reflectors'),
        sunsMetric: requireElement<HTMLElement>('#metric-suns'),
    }
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

function toMegabytes(bytes: number): string {
    return (bytes / 1024 / 1024).toFixed(1)
}

function formatMemory(): string {
    const memory = (performance as MemoryPerformance).memory

    if (!memory) {
        return 'n/a'
    }

    return `${toMegabytes(memory.usedJSHeapSize)} / ${toMegabytes(memory.jsHeapSizeLimit)} MB`
}

export class DebugPanel {
    private readonly elements: DebugPanelElements
    private readonly savedSettings: DebugWindowSettings
    private panelDrag: PanelDrag | undefined
    private nextMetricsUpdate = 0
    private soundButtonState: SoundButtonState
    private soundToggleHandler: SoundToggleHandler
    private paused = false

    constructor() {
        this.elements = createDebugPanelElements()
        this.savedSettings = readDebugWindowSettings()
        this.soundButtonState = {
            enabled: false,
            preferred: this.savedSettings.soundPreferred ?? false,
        }
        this.soundToggleHandler = () => this.soundButtonState
    }

    get root(): HTMLElement {
        return this.elements.panel
    }

    get showLighting(): boolean {
        return this.elements.lightingToggle.checked
    }

    get showCollision(): boolean {
        return this.elements.collisionToggle.checked
    }

    get noClip(): boolean {
        return this.elements.noclipToggle.checked
    }

    get soundPreferred(): boolean {
        return this.savedSettings.soundPreferred ?? false
    }

    get isPaused(): boolean {
        return this.paused
    }

    setSoundToggleHandler(handler: SoundToggleHandler): void {
        this.soundToggleHandler = handler
    }

    setSoundButtonState(state: SoundButtonState): void {
        this.soundButtonState = state
        this.updateSoundButton()
    }

    start(): void {
        this.applySavedToggleSettings()
        this.initializeWindow()
        this.elements.soundToggle.addEventListener('click', this.handleSoundToggleClick)
        this.elements.pauseToggle.addEventListener('click', this.handlePauseToggleClick)
        this.elements.lightingToggle.addEventListener('change', this.handleLightingToggleChange)
        this.elements.collisionToggle.addEventListener('change', this.handleCollisionToggleChange)
        this.updateSoundButton()
        this.updatePauseButton()
    }

    updateMetrics(metrics: DiagnosticsMetrics): void {
        const now = performance.now()

        if (now < this.nextMetricsUpdate) {
            return
        }

        this.nextMetricsUpdate = now + 120
        this.elements.fpsMetric.textContent = metrics.fps.toFixed(0)
        this.elements.frameMetric.textContent = `${metrics.frameMs.toFixed(2)}ms`
        this.elements.updateMetric.textContent = `${metrics.updateMs.toFixed(2)}ms`
        this.elements.renderMetric.textContent = `${metrics.renderMs.toFixed(2)}ms`
        this.elements.rayTimeMetric.textContent = `${metrics.rayMs.toFixed(2)}ms`
        this.elements.raysMetric.textContent = String(metrics.rays)
        this.elements.checksMetric.textContent = String(metrics.rayChecks)
        this.elements.memoryMetric.textContent = formatMemory()
        this.elements.groundedMetric.textContent = String(metrics.grounded)
        this.elements.velocityMetric.textContent = `${metrics.velocity.x.toFixed(1)}, ${metrics.velocity.y.toFixed(1)}`
        this.elements.mapSizeMetric.textContent = metrics.mapSize
        this.elements.solidsMetric.textContent = String(metrics.solids)
        this.elements.reflectorsMetric.textContent = String(metrics.reflectors)
        this.elements.sunsMetric.textContent = `${metrics.activeSuns} / ${metrics.totalSuns}`
    }

    private applySavedToggleSettings(): void {
        if (this.savedSettings.showLighting !== undefined) {
            this.elements.lightingToggle.checked = this.savedSettings.showLighting
        }

        if (this.savedSettings.showCollision !== undefined) {
            this.elements.collisionToggle.checked = this.savedSettings.showCollision
        }
    }

    private initializeWindow(): void {
        if (this.savedSettings.panelLeft !== undefined && this.savedSettings.panelTop !== undefined) {
            this.setPosition(this.savedSettings.panelLeft, this.savedSettings.panelTop)
        } else {
            this.resetPosition()
        }

        window.addEventListener('resize', this.keepInViewport)
        window.addEventListener('pointermove', this.moveDrag)
        window.addEventListener('pointerup', this.stopDrag)
        window.addEventListener('pointercancel', this.stopDrag)
        this.elements.handle.addEventListener('pointerdown', this.startDrag)
        this.elements.handle.addEventListener('keydown', this.moveWithKeyboard)
        this.elements.reset.addEventListener('click', this.resetPosition)
    }

    private readonly handleSoundToggleClick = async (): Promise<void> => {
        this.soundButtonState = await this.soundToggleHandler()
        saveDebugWindowSettings({
            soundPreferred: this.soundButtonState.preferred,
        })
        this.updateSoundButton()
    }

    private readonly handlePauseToggleClick = (): void => {
        this.paused = !this.paused
        this.updatePauseButton()
    }

    private readonly handleLightingToggleChange = (): void => {
        saveDebugWindowSettings({
            showLighting: this.elements.lightingToggle.checked,
        })
    }

    private readonly handleCollisionToggleChange = (): void => {
        saveDebugWindowSettings({
            showCollision: this.elements.collisionToggle.checked,
        })
    }

    private readonly startDrag = (event: PointerEvent): void => {
        if (event.button !== 0) {
            return
        }

        const rect = this.elements.panel.getBoundingClientRect()

        this.panelDrag = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
        }
        this.elements.panel.classList.add('is-dragging')
        this.elements.handle.setPointerCapture(event.pointerId)
        event.preventDefault()
    }

    private readonly moveDrag = (event: PointerEvent): void => {
        if (!this.panelDrag || event.pointerId !== this.panelDrag.pointerId) {
            return
        }

        this.setPosition(event.clientX - this.panelDrag.offsetX, event.clientY - this.panelDrag.offsetY)
    }

    private readonly stopDrag = (event: PointerEvent): void => {
        if (!this.panelDrag || event.pointerId !== this.panelDrag.pointerId) {
            return
        }

        this.panelDrag = undefined
        this.elements.panel.classList.remove('is-dragging')

        if (this.elements.handle.hasPointerCapture(event.pointerId)) {
            this.elements.handle.releasePointerCapture(event.pointerId)
        }
    }

    private readonly moveWithKeyboard = (event: KeyboardEvent): void => {
        const rect = this.elements.panel.getBoundingClientRect()
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
            this.resetPosition()
            event.preventDefault()
            event.stopPropagation()
            return
        } else {
            return
        }

        this.setPosition(nextX, nextY)
        event.preventDefault()
        event.stopPropagation()
    }

    private readonly resetPosition = (): void => {
        const stageRect = this.elements.stage.getBoundingClientRect()
        const panelRect = this.elements.panel.getBoundingClientRect()
        const left = Math.min(stageRect.right - panelRect.width - 16, window.innerWidth - panelRect.width - panelMargin)
        const top = Math.max(stageRect.top + 16, panelMargin)

        this.setPosition(left, top)
    }

    private readonly keepInViewport = (): void => {
        const rect = this.elements.panel.getBoundingClientRect()

        this.setPosition(rect.left, rect.top)
    }

    private setPosition(left: number, top: number): void {
        const rect = this.elements.panel.getBoundingClientRect()
        const maxLeft = Math.max(panelMargin, window.innerWidth - rect.width - panelMargin)
        const maxTop = Math.max(panelMargin, window.innerHeight - rect.height - panelMargin)

        this.elements.panel.style.left = `${clamp(left, panelMargin, maxLeft)}px`
        this.elements.panel.style.top = `${clamp(top, panelMargin, maxTop)}px`
        this.elements.panel.style.right = 'auto'
        this.elements.panel.style.bottom = 'auto'

        saveDebugWindowSettings({
            panelLeft: Number.parseFloat(this.elements.panel.style.left),
            panelTop: Number.parseFloat(this.elements.panel.style.top),
        })
    }

    private updateSoundButton(): void {
        if (this.soundButtonState.enabled) {
            this.elements.soundToggle.textContent = 'Sound enabled'
        } else if (this.soundButtonState.preferred) {
            this.elements.soundToggle.textContent = 'Enable saved sound'
        } else {
            this.elements.soundToggle.textContent = 'Enable sound'
        }

        this.elements.soundToggle.setAttribute('aria-pressed', String(this.soundButtonState.preferred))
    }

    private updatePauseButton(): void {
        this.elements.pauseToggle.textContent = this.paused ? 'Resume game' : 'Pause game'
        this.elements.pauseToggle.setAttribute('aria-pressed', String(this.paused))
    }
}
