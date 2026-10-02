import { grammarExtensionSchema, languageExtensionSchema } from '../extensions/manifest';
import type { GrammarExtension } from '../extensions/grammar';
import type { LanguageExtension } from '../extensions/lsp';
import type { GrammarLanguage } from '../ipc/schemas/grammar';

export function isLanguageExtension(value: unknown): value is LanguageExtension {
  return languageExtensionSchema.safeParse(value).success;
}

export function isGrammarExtension(value: unknown): value is GrammarExtension {
  return grammarExtensionSchema.safeParse(value).success;
}

export function languageIdOf(
  languages: readonly GrammarLanguage[],
  filePath: string,
): string | undefined {
  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
  return languages.find(
    (language) =>
      language.filenames?.includes(fileName) ||
      language.extensions.some((extension) => fileName.endsWith(`.${extension}`)),
  )?.name;
}
