import type { LanguageExtension } from '@gepard/common';
import { open } from './server';

export default {
  id: 'csharp',
  displayName: 'C#',
  languages: [{ name: 'csharp', extensions: ['cs', 'csx'] }],
  open,
} satisfies LanguageExtension;
