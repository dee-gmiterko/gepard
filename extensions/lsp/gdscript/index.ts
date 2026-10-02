import type { LanguageExtension } from '@gepard/common';
import { open } from './server';

export default {
  id: 'gdscript',
  displayName: 'GDScript',
  languages: [{ name: 'gdscript', extensions: ['gd'] }],
  open,
} satisfies LanguageExtension;
