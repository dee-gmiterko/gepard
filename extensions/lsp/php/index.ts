import { languageIdOf, type ExtensionLanguage, type LanguageExtension } from '@gepard/common';
import { open } from './server';

const languages: ExtensionLanguage[] = [{ name: 'php', extensions: ['php', 'phtml', 'inc'] }];

function isVendored(file: string): boolean {
  return file.split(/[\\/]/).includes('vendor');
}

export default {
  id: 'php',
  displayName: 'PHP',
  languages,
  warmupFile: (files) =>
    files.find((f) => languageIdOf(languages, f) !== undefined && !isVendored(f)),
  open: (project, host, sink) => open(project, host, sink, languages),
} satisfies LanguageExtension;
