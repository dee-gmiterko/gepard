# Dependency resolutions

- `typescript` `<7.0.0`: `typescript-eslint` 8.70 supports `>=4.8.4 <6.1.0` and throws on TypeScript 7.
- `vite` `<8.0.0`: `electron-vite` 5 supports `^5.0.0 || ^6.0.0 || ^7.0.0`; with vite 8 the npm `electron` package is bundled into `out/main`.
- `@vitejs/plugin-react` `5.2.0`: 6.x requires vite 8.
