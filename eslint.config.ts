import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import { defineConfig } from 'eslint/config'

export default defineConfig(js.configs.recommended, ...tseslint.configs.recommended, eslintConfigPrettier, {
    ignores: ['**/dist/**'],
    rules: {
        'no-use-before-define': 'off',
        'no-unused-vars': 'off',

        '@typescript-eslint/no-use-before-define': 'error',
        '@typescript-eslint/no-unused-vars': [
            'error',
            {
                argsIgnorePattern: '^_',
            },
        ],
    },
})
