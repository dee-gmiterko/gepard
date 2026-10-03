import { defineConfig } from 'eslint/config';
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier';
import eslintReact from '@eslint-react/eslint-plugin';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh';
import eslintPluginFormatjs from 'eslint-plugin-formatjs';
import { ignores, javascript, typescript } from './index.mjs';

export default function createReactConfig(options) {
  return defineConfig(
    ignores,
    javascript,
    typescript(options),
    {
      files: ['**/*.{ts,tsx}'],
      extends: [eslintReact.configs['recommended-typescript']],
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
}
