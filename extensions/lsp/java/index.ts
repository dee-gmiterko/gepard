import type { LanguageExtension } from '@gepard/common';
import { open } from './server';

export default {
  id: 'java',
  displayName: 'Java',
  languages: [{ name: 'java', extensions: ['java'] }],
  open,
} satisfies LanguageExtension;
