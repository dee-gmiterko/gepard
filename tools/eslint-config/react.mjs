import { defineConfig } from 'eslint/config';
import tseslint from '@electron-toolkit/eslint-config-ts';
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier';
import eslintPluginReact from 'eslint-plugin-react';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh';
import eslintPluginFormatjs from 'eslint-plugin-formatjs';

export default defineConfig(
  { ignores: ['**/node_modules', '**/dist', '**/out'] },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh,
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules,
    },
  },
  {
    files: ['src/queries/**/*.ts'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
  {
    files: ['**/*.mjs'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { formatjs: eslintPluginFormatjs },
    rules: {
      'formatjs/enforce-default-message': 'error',
      'formatjs/enforce-id': 'error',
      'formatjs/enforce-placeholders': 'error',
      'formatjs/no-complex-selectors': 'error',
      'formatjs/no-emoji': 'error',
      'formatjs/no-invalid-icu': 'error',
      'formatjs/no-literal-string-in-jsx': [
        'error',
        {
          props: {
            include: [
              ['*', 'label'],
              ['*', 'placeholder'],
              ['*', 'title'],
              ['*', 'alt'],
              ['*', 'aria-label'],
              ['*', 'aria-description'],
              ['*', 'aria-details'],
              ['*', 'aria-errormessage'],
              ['*', 'aria-placeholder'],
              ['*', 'aria-roledescription'],
              ['*', 'aria-valuetext'],
            ],
          },
        },
      ],
      'formatjs/no-literal-string-in-object': ['error', { include: ['message', 'label'] }],
      'formatjs/no-multiple-plurals': 'error',
      'formatjs/no-multiple-whitespaces': 'error',
      'formatjs/no-offset': 'error',
      'formatjs/no-useless-message': 'error',
    },
  },
  eslintConfigPrettier,
);
