import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// Main-process modules only import `electron` for `app.getPath` and
// `webContents.send` (report 04 §4.1 userData layout, ipc/registry.ts's
// `emit`); alias it to a small mock (test/support/electron.ts) so tests run
// under plain Node, with userData pointed at a temp directory per test file
// and emitted events recorded for assertions.
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      electron: resolve(__dirname, 'test/support/electron.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 20_000
  }
})
