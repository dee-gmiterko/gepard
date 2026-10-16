import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  ssr: { noExternal: [/^@gepard\//] },
  build: {
    ssr: true,
    outDir: 'dist',
    emptyOutDir: false,
    target: 'node24',
    rollupOptions: {
      input: {
        server: resolve('index.ts'),
        'line-index-worker': resolve('../main/services/line-index-worker.ts'),
      },
      output: { format: 'es', entryFileNames: '[name].js' },
    },
  },
});
