import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// The `electron` module can only be loaded inside the Electron runtime, so
// it's aliased to a mock (test/support/electron.ts) to run tests under plain
// Node.
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
