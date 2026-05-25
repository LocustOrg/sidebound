export type EngineClock = {
    now(): number
    sleep?(ms: number): Promise<void>
}

export type AnimationFrameClock = EngineClock & {
    requestFrame(callback: (now: number) => void): number
    cancelFrame(frameId: number): void
}
