/**
 * SDL key-value storage backed by a JSON file on disk.
 */

import type { KeyValueStorage } from '@sidebound/engine'

export class SdlFileStorage implements KeyValueStorage {
    private readonly path: string
    private data: Record<string, string> = {}
    private loaded = false

    constructor(path: string) {
        this.path = path
    }

    async getItem(key: string): Promise<string | null> {
        await this.ensureLoaded()
        return this.data[key] ?? null
    }

    async setItem(key: string, value: string): Promise<void> {
        await this.ensureLoaded()
        this.data[key] = value
        await this.persist()
    }

    async removeItem(key: string): Promise<void> {
        await this.ensureLoaded()
        delete this.data[key]
        await this.persist()
    }

    private async ensureLoaded(): Promise<void> {
        if (this.loaded) return

        try {
            const text = await Deno.readTextFile(this.path)
            this.data = JSON.parse(text)
        } catch {
            this.data = {}
        }

        this.loaded = true
    }

    private async persist(): Promise<void> {
        await Deno.writeTextFile(this.path, JSON.stringify(this.data, null, 2))
    }
}
