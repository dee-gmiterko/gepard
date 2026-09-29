import { defineConfig } from 'eslint/config';
import base from '@gepard/eslint-config';

export default defineConfig({ ignores: ['test/fixtures'] }, base);
