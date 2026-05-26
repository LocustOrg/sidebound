/**
 * Configurable debug logger for the Sidebound engine.
 * Provides verbosity levels, categorized output, and frame-throttled logging.
 */

export const LogLevel = {
    None: 0,
    Error: 1,
    Warn: 2,
    Info: 3,
    Debug: 4,
    Trace: 5,
} as const

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel]

export type LogEntry = {
    readonly level: LogLevel
    readonly category: string
    readonly message: string
    readonly timestamp: number
    readonly data?: unknown
}

export type DebugLoggerOptions = {
    readonly level?: LogLevel
    readonly maxHistory?: number
    readonly printToConsole?: boolean
    readonly prefix?: string
}

const LOG_LABELS: Record<number, string> = {
    [LogLevel.Error]: 'ERR',
    [LogLevel.Warn]: 'WRN',
    [LogLevel.Info]: 'INF',
    [LogLevel.Debug]: 'DBG',
    [LogLevel.Trace]: 'TRC',
}

export class DebugLogger {
    private _level: LogLevel
    private readonly maxHistory: number
    private readonly printToConsole: boolean
    private readonly prefix: string
    private readonly history: LogEntry[] = []
    private frameCount = 0

    constructor(options: DebugLoggerOptions = {}) {
        this._level = options.level ?? LogLevel.Info
        this.maxHistory = options.maxHistory ?? 200
        this.printToConsole = options.printToConsole ?? true
        this.prefix = options.prefix ?? '[Sidebound]'
    }

    get level(): LogLevel {
        return this._level
    }

    set level(value: LogLevel) {
        this._level = value
    }

    get entries(): readonly LogEntry[] {
        return this.history
    }

    /** Call once per frame to increment internal frame counter */
    tick(): void {
        this.frameCount++
    }

    error(category: string, message: string, data?: unknown): void {
        this.log(LogLevel.Error, category, message, data)
    }

    warn(category: string, message: string, data?: unknown): void {
        this.log(LogLevel.Warn, category, message, data)
    }

    info(category: string, message: string, data?: unknown): void {
        this.log(LogLevel.Info, category, message, data)
    }

    debug(category: string, message: string, data?: unknown): void {
        this.log(LogLevel.Debug, category, message, data)
    }

    trace(category: string, message: string, data?: unknown): void {
        this.log(LogLevel.Trace, category, message, data)
    }

    /** Log at most once every N frames for the given key */
    throttled(_key: string, intervalFrames: number, level: LogLevel, category: string, message: string, data?: unknown): void {
        if (this.frameCount % intervalFrames !== 0) return
        this.log(level, category, message, data)
    }

    clear(): void {
        this.history.length = 0
    }

    private log(level: LogLevel, category: string, message: string, data?: unknown): void {
        if (level > this._level) return

        const entry: LogEntry = {
            level,
            category,
            message,
            timestamp: performance.now(),
            data,
        }

        this.history.push(entry)
        if (this.history.length > this.maxHistory) {
            this.history.shift()
        }

        if (this.printToConsole) {
            const label = LOG_LABELS[level] ?? '???'
            const formatted = `${this.prefix} [${label}] [${category}] ${message}`

            if (level === LogLevel.Error) {
                console.error(formatted, data !== undefined ? data : '')
            } else if (level === LogLevel.Warn) {
                console.warn(formatted, data !== undefined ? data : '')
            } else {
                console.log(formatted, data !== undefined ? data : '')
            }
        }
    }
}

/** Singleton engine logger. Games can replace or reconfigure. */
export const engineLogger = new DebugLogger({ level: LogLevel.Info, prefix: '[Engine]' })


