import { defineConfig } from 'eslint/config';
import electronToolkitTs from '@electron-toolkit/eslint-config-ts';
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier';

export const ignores = { ignores: ['**/node_modules', '**/dist', '**/out'] };

export const javascript = {
  files: ['**/*.{js,mjs,cjs}'],
  extends: [electronToolkitTs.configs.base],
  languageOptions: { ecmaVersion: 'latest', parserOptions: { ecmaVersion: 'latest' } },
};

export const typescript = ({ tsconfigRootDir }) => ({
  files: ['**/*.{ts,tsx}'],
  extends: [electronToolkitTs.configs.recommendedTypeChecked],
  languageOptions: {
    parserOptions: { projectService: true, tsconfigRootDir },
  },
  rules: {
    '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
  },
});

export const scripts = {
  files: ['**/scripts/**/*.ts'],
  rules: { '@typescript-eslint/consistent-type-assertions': 'off' },
};

export default function createConfig(options) {
  return defineConfig(ignores, javascript, typescript(options), scripts, eslintConfigPrettier);
}
