import { configDefaults, defineConfig } from 'vitest/config';

// extension.test.ts downloads the PHPantom binary from GitHub releases
const exclude = process.env.CI
  ? [...configDefaults.exclude, 'test/extension.test.ts']
  : configDefaults.exclude;

export default defineConfig({ test: { exclude } });
