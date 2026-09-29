import type { LanguageSupport, LRLanguage, StreamLanguage } from '@codemirror/language';
import type { styleTags, tags } from '@lezer/highlight';
import type { LRParser } from '@lezer/lr';

export interface GrammarApi {
  StreamLanguage: typeof StreamLanguage;
  LRLanguage: typeof LRLanguage;
  LanguageSupport: typeof LanguageSupport;
  styleTags: typeof styleTags;
  tags: typeof tags;
  LRParser: typeof LRParser;
}
