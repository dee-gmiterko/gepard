import {
  languageIdOf,
  type ExtensionLanguage,
  type ImportResolution,
  type LanguageExtension,
} from '@gepard/common';
import { open } from './server';

const languages: ExtensionLanguage[] = [
  { name: 'typescript', extensions: ['ts', 'mts', 'cts'] },
  { name: 'typescriptreact', extensions: ['tsx'] },
  { name: 'javascript', extensions: ['js', 'mjs', 'cjs'] },
  { name: 'javascriptreact', extensions: ['jsx'] },
];

const importResolution: ImportResolution = {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.d.ts', '.vue', '.svelte'],
  indexFiles: ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mjs', 'index.cjs'],
  emittedExtensions: ['.js', '.mjs', '.cjs'],
};

export default {
  id: 'typescript',
  displayName: 'TypeScript',
  languages,
  importResolution,
  warmupFile: (files) =>
    files.find((f) => languageIdOf(languages, f) !== undefined && !f.endsWith('.d.ts')),
  open: (project, host, sink) => open(project, host, sink, languages),
} satisfies LanguageExtension;
