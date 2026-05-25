import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
    resolve: {
        alias: {
            '@sidebound/engine': fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)),
            '@sidebound/platform-browser-preview': fileURLToPath(new URL('../platform-browser-preview/src/index.ts', import.meta.url)),
        },
    },
})
