import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['test/**/*.test.tsx'],
          setupFiles: ['test/support/setup.ts'],
          testTimeout: 15_000,
        },
      },
    ],
  },
});
