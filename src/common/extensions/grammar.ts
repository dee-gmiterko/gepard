import type { GrammarLanguage } from '../ipc/schemas/grammar';

export interface GrammarExtension {
  id: string;
  displayName: string;
  languages: GrammarLanguage[];
  support(api: unknown, language: string): unknown;
}
