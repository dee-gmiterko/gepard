import type { LanguageExtension } from '@gepard/common';
import { languageId, matches, warmupFile } from './helpers/language';
import { open } from './server';

export default {
  id: 'python',
  displayName: 'Python',
  matches,
  languageId,
  warmupFile,
  open,
} satisfies LanguageExtension;
