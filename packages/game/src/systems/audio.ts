export type SoundButtonState = {
    enabled: boolean
    preferred: boolean
}

export type SoundCue = {
    frequency: number
    durationSeconds: number
    gain: number
}

export class DemoAudio {
    private audioContext: AudioContext | undefined
    private enabled = false
    private preferred: boolean

    constructor(soundPreferred: boolean) {
        this.preferred = soundPreferred
    }

    get state(): SoundButtonState {
        return {
            enabled: this.enabled,
            preferred: this.preferred,
        }
    }

    async toggle(): Promise<SoundButtonState> {
        if (!this.audioContext) {
            this.audioContext = new AudioContext()
        }

        if (this.enabled) {
            this.enabled = false
            this.preferred = false

            return this.state
        }

        await this.audioContext.resume()
        this.enabled = true
        this.preferred = true
        this.playTone({
            frequency: 196,
            durationSeconds: 0.08,
            gain: 0.035,
        })

        return this.state
    }

    playTone(cue: SoundCue): void {
        if (!this.audioContext || !this.enabled) {
            return
        }

        const now = this.audioContext.currentTime
        const oscillator = this.audioContext.createOscillator()
        const gain = this.audioContext.createGain()

        oscillator.type = 'triangle'
        oscillator.frequency.setValueAtTime(cue.frequency, now)
        gain.gain.setValueAtTime(0.0001, now)
        gain.gain.exponentialRampToValueAtTime(cue.gain, now + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.durationSeconds)
        oscillator.connect(gain)
        gain.connect(this.audioContext.destination)
        oscillator.start(now)
        oscillator.stop(now + cue.durationSeconds)
    }
}
