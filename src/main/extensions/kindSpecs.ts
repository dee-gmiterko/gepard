import {
  isGrammarExtension,
  isLanguageExtension,
  isLocaleExtension,
  isThemeExtension,
  type GrammarExtension,
  type LanguageExtension,
  type LocaleExtension,
  type ThemeExtension,
} from '@gepard/common';
import type { KindSpec } from './kindRegistry';

export const LSP_SPEC: KindSpec<LanguageExtension> = {
  kind: 'lsp',
  isValid: isLanguageExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

export const GRAMMAR_SPEC: KindSpec<GrammarExtension> = {
  kind: 'grammar',
  isValid: isGrammarExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};

export const THEME_SPEC: KindSpec<ThemeExtension> = {
  kind: 'theme',
  isValid: isThemeExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.name,
};

export const LOCALE_SPEC: KindSpec<LocaleExtension> = {
  kind: 'locale',
  isValid: isLocaleExtension,
  getId: (item) => item.id,
  getDisplayName: (item) => item.displayName,
};
