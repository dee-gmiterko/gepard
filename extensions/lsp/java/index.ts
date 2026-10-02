import type { LanguageExtension } from '@gepard/common';
import { languageId, matches, warmupFile } from './helpers/language';
import { open } from './server';

export default {
  id: 'java',
  displayName: 'Java',
  matches,
  languageId,
  warmupFile,
  open,
} satisfies LanguageExtension;
