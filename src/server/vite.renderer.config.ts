import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const HOST = 'browser';
const HOST_MODULE = 'virtual:gepard-host';
const RESOLVED_HOST_MODULE = `\0${HOST_MODULE}`;

function gepardHost(): Plugin {
  return {
    name: 'gepard-host',
    resolveId: (id) => (id === HOST_MODULE ? RESOLVED_HOST_MODULE : null),
    load: (id) =>
      id === RESOLVED_HOST_MODULE
        ? `import { createSocketBridge, socketUrl } from '/src/ipc/socketBridge.ts';
window.gepard = { host: ${JSON.stringify(HOST)}, ipc: createSocketBridge(socketUrl(window.location)) };`
        : null,
    transformIndexHtml: {
      order: 'pre',
      handler: () => [
        { tag: 'script', attrs: { type: 'module', src: HOST_MODULE }, injectTo: 'head-prepend' },
      ],
    },
  };
}

export default defineConfig({
  root: resolve('../renderer'),
  build: {
    outDir: resolve('dist/renderer'),
    emptyOutDir: true,
    rollupOptions: { input: resolve('../renderer/index.html') },
  },
  plugins: [react(), gepardHost()],
});
