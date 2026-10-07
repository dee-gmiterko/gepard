import { languageIdOf, type ExtensionLanguage, type LanguageExtension } from '@gepard/common';
import { open } from './server';
import { isSourceFile } from './compdb';

const languages: ExtensionLanguage[] = [
  { name: 'cpp', extensions: ['cpp', 'cc', 'cxx', 'c++', 'hpp', 'hh', 'hxx', 'h++', 'h', 'inl'] },
  { name: 'c', extensions: ['c'] },
];

export default {
  id: 'cpp',
  displayName: 'C/C++',
  languages,
  warmupFile: (files) =>
    files.find((f) => languageIdOf(languages, f) !== undefined && isSourceFile(f)),
  open: (project, host, sink) => open(project, host, sink, languages),
} satisfies LanguageExtension;
