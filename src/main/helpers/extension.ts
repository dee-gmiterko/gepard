import { LocaleData, ThemeTemplateData } from '@gepard/common';

export function isThemeTemplate(value: unknown): value is ThemeTemplateData {
  return ThemeTemplateData.safeParse(value).success;
}

export function isLocaleData(value: unknown): value is LocaleData {
  return LocaleData.safeParse(value).success;
}
