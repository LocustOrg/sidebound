import { defineConfig } from 'eslint/config'
import baseConfig from '../../eslint.config'

export default defineConfig({
    ignores: ['dist/**'],
}, ...baseConfig, {
    files: ['src/**/*.ts', 'vite.config.ts'],
    rules: {
        'no-use-before-define': 'off',
        'no-unused-expressions': 'off',
        'no-unused-vars': 'off',

        // Rules
        '@typescript-eslint/no-use-before-define': 'error',
        '@typescript-eslint/no-unused-expressions': 'error',
        '@typescript-eslint/no-unused-vars': ['error', {
            // ignore what starts with _
            'argsIgnorePattern': '^_',
        }],
    },
})
