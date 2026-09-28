// Locales are a registrable extension type (`extensions/locales/*`, same as
// `extensions/themes/*`), loaded by the main process and fetched over IPC
// (`locales.list`, see `../queries/locales`) like any other extension. The
// catalog bundled here is not that mechanism - it is the one locale baked
// directly into the app itself (mirroring theme's `FALLBACK_TEMPLATE`), used
// only so `intl` has messages available synchronously at renderer bootstrap,
// before IPC is even reachable and before the real, extension-backed locale
// list has loaded (or if it fails to load at all).
import fallbackMessages from '../locales/en.json';

export const fallbackLocale = 'en';

export const fallbackMessagesByLocale: Record<string, Record<string, string>> = {
  [fallbackLocale]: fallbackMessages,
};

export const defaultLocale = fallbackLocale;
