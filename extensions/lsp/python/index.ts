import type { LanguageExtension } from '@gepard/common';
import { open } from './server';

export default {
  id: 'python',
  displayName: 'Python',
  languages: [{ name: 'python', extensions: ['py', 'pyi'] }],
  open,
} satisfies LanguageExtension;
