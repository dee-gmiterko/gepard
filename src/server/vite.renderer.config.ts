import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: resolve('../renderer'),
  build: {
    outDir: resolve('dist/renderer'),
    emptyOutDir: true,
    rollupOptions: { input: resolve('../renderer/index.html') },
  },
  plugins: [react()],
});
