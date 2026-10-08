import { defineConfig } from 'eslint/config';
import createConfig from '@gepard/eslint-config';

export default defineConfig(
  { ignores: ['test/fixtures', 'dist'] },
  createConfig({ tsconfigRootDir: import.meta.dirname }),
);
