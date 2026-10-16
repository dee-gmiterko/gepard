import createConfig from '@gepard/eslint-config';

const HOST_MESSAGE =
  'The core is host-agnostic: it must not depend on Electron, the server or any package of a host.';

export default [
  ...createConfig({ tsconfigRootDir: import.meta.dirname }),
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'electron', message: HOST_MESSAGE },
            { name: 'ws', message: HOST_MESSAGE },
          ],
          patterns: [
            { group: ['electron/*', '@electron-toolkit/*'], message: HOST_MESSAGE },
            {
              group: [
                '@gepard/electron',
                '@gepard/electron/*',
                '@gepard/server',
                '@gepard/server/*',
              ],
              message: HOST_MESSAGE,
            },
          ],
        },
      ],
    },
  },
];
