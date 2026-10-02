import type { Language, LanguageSupport, LRLanguage, StreamLanguage } from '@codemirror/language';
import type { styleTags, tags } from '@lezer/highlight';
import type { LRParser } from '@lezer/lr';
import type { ExtensionLanguage } from './language';

export interface GrammarApi {
  StreamLanguage: typeof StreamLanguage;
  LRLanguage: typeof LRLanguage;
  LanguageSupport: typeof LanguageSupport;
  styleTags: typeof styleTags;
  tags: typeof tags;
  LRParser: typeof LRParser;
}

export interface GrammarExtension {
  id: string;
  displayName: string;
  languages: ExtensionLanguage[];
  support(api: GrammarApi, language: string): Language | LanguageSupport;
}
