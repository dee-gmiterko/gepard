import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Workspace packages ship TypeScript sources, so they are bundled; everything else is
// resolved from node_modules at run time. Core modules use __dirname (the line index
// worker is located next to the entry), which ES modules lack.
const DIRNAME_BANNER = [
  "import { fileURLToPath as __fileURLToPath } from 'node:url';",
  "import { dirname as __dirnameOf } from 'node:path';",
  'const __dirname = __dirnameOf(__fileURLToPath(import.meta.url));',
].join('\n');

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
      output: { format: 'es', entryFileNames: '[name].js', banner: DIRNAME_BANNER },
    },
  },
});
