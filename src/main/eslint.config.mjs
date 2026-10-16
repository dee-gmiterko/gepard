import createConfig from '@gepard/eslint-config';

const ELECTRON_ONLY_FILES = ['index.ts', '**/electron[A-Z]*.ts'];

const ELECTRON_BOUNDARY_MESSAGE =
  'Electron is available only in the electron-only files (index.ts and electron*.ts); the server must never load it.';

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
            { name: 'electron', message: ELECTRON_BOUNDARY_MESSAGE, allowTypeImports: true },
            { name: 'electron/main', message: ELECTRON_BOUNDARY_MESSAGE, allowTypeImports: true },
            {
              name: 'electron/renderer',
              message: ELECTRON_BOUNDARY_MESSAGE,
              allowTypeImports: true,
            },
          ],
          patterns: [
            { group: ['@electron-toolkit/*'], message: ELECTRON_BOUNDARY_MESSAGE },
            { group: ['**/electron[A-Z]*'], message: ELECTRON_BOUNDARY_MESSAGE },
          ],
        },
      ],
    },
  },
  {
    files: ELECTRON_ONLY_FILES,
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },
];
