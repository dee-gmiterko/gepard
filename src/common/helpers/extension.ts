import { grammarExtensionSchema, languageExtensionSchema } from '../extensions/manifest';
import type { GrammarExtension } from '../extensions/grammar';
import type { LanguageExtension } from '../extensions/lsp';

export function isLanguageExtension(value: unknown): value is LanguageExtension {
  return languageExtensionSchema.safeParse(value).success;
}

export function isGrammarExtension(value: unknown): value is GrammarExtension {
  return grammarExtensionSchema.safeParse(value).success;
}
