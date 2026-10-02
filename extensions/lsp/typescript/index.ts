import { languageIdOf, type ExtensionLanguage, type LanguageExtension } from '@gepard/common';
import { open } from './server';

const languages: ExtensionLanguage[] = [
  { name: 'typescript', extensions: ['ts', 'mts', 'cts'] },
  { name: 'typescriptreact', extensions: ['tsx'] },
  { name: 'javascript', extensions: ['js', 'mjs', 'cjs'] },
  { name: 'javascriptreact', extensions: ['jsx'] },
];

export default {
  id: 'typescript',
  displayName: 'TypeScript',
  languages,
  warmupFile: (files) =>
    files.find((f) => languageIdOf(languages, f) !== undefined && !f.endsWith('.d.ts')),
  open: (project, host, sink) => open(project, host, sink, languages),
} satisfies LanguageExtension;
