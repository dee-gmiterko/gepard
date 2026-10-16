import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Workspace packages ship TypeScript sources, so they are bundled; everything else is
// resolved from node_modules at run time.
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
