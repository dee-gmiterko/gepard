import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve('../main/index.ts'),
          'line-index-worker': resolve('../main/services/line-index-worker.ts'),
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    build: {
      // Electron's sandboxed preload loader only supports CommonJS, so the
      // output must stay CJS (and use a .cjs extension) even though
      // package.json sets "type": "module" for the rest of the app.
      rollupOptions: {
        input: { index: resolve('../preload/index.ts') },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve('../renderer'),
    build: {
      outDir: resolve('out/renderer'),
      emptyOutDir: true,
      rollupOptions: { input: resolve('../renderer/index.html') },
    },
    plugins: [react()],
  },
});
