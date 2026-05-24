import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
    resolve: {
        alias: {
            '@sidebound/engine': fileURLToPath(new URL('../engine/src/index.ts', import.meta.url)),
        },
    },
})
