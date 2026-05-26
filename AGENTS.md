# Sidebound Style Guide

- React code should never use `useMemo`, `useCallback`, or `memo`; these projects rely on the React compiler.
- Deno module barrels are named `mod.ts`, not `index.ts`.
- `mod.ts` files must be export-only: use re-export statements such as `export * from './feature.ts'` or `export { Name } from './feature.ts'`; do not put declarations, logic, side effects, or runtime imports in `mod.ts`.
- Sidebound is moving fully toward the Deno + SDL3 runtime. Treat the browser renderer as temporary migration scaffolding only; do not add new browser-renderer features.
