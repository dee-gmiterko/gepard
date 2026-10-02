import type { LanguageExtension } from '@gepard/common';
import { languageId, matches, warmupFile } from './helpers/language';
import { open } from './server';

export default {
  id: 'typescript',
  displayName: 'TypeScript',
  matches,
  languageId,
  warmupFile,
  open,
} satisfies LanguageExtension;
