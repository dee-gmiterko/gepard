import { configDefaults, defineConfig } from 'vitest/config';

// extension.test.ts launches the real language server binary, which CI does not install
const exclude = process.env.CI
  ? [...configDefaults.exclude, 'test/extension.test.ts']
  : configDefaults.exclude;

export default defineConfig({ test: { exclude } });
