import { defineConfig } from 'eslint/config';
import createConfig from '@gepard/eslint-config';

export default defineConfig(createConfig({ tsconfigRootDir: import.meta.dirname }));
