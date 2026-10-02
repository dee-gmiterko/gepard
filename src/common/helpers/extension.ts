import type { GrammarExtension } from '../extensions/grammar';
import type { ExtensionLanguage } from '../extensions/language';
import { localeExtensionSchema, type LocaleExtension } from '../extensions/locale';
import type { LanguageExtension } from '../extensions/lsp';
import { grammarExtensionSchema, languageExtensionSchema } from '../extensions/manifest';
import { themeExtensionSchema, type ThemeExtension } from '../extensions/theme';

export function isLanguageExtension(value: unknown): value is LanguageExtension {
  return languageExtensionSchema.safeParse(value).success;
}

export function isGrammarExtension(value: unknown): value is GrammarExtension {
  return grammarExtensionSchema.safeParse(value).success;
}

export function isThemeExtension(value: unknown): value is ThemeExtension {
  return themeExtensionSchema.safeParse(value).success;
}

export function isLocaleExtension(value: unknown): value is LocaleExtension {
  return localeExtensionSchema.safeParse(value).success;
}

export function languageIdOf(
  languages: readonly ExtensionLanguage[],
  filePath: string,
): string | undefined {
  const fileName = filePath.slice(filePath.lastIndexOf('/') + 1);
  return languages.find(
    (language) =>
      language.filenames?.includes(fileName) ||
      language.extensions.some((extension) => fileName.endsWith(`.${extension}`)),
  )?.name;
}
