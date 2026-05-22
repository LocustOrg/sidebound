import { defineConfig } from 'eslint/config'
import baseConfig from '../../eslint.config'

export default defineConfig(...baseConfig, {
    files: ['src/**/*.ts', 'vite.config.ts'],
    rules: {
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': [
            'error',
            {
                functions: true,
                classes: true,
                variables: true,
                enums: false,
                typedefs: false,
                ignoreTypeReferences: true,
            },
        ],
    },
})
