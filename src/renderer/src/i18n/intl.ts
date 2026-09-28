import { createIntl, createIntlCache, ReactIntlErrorCode } from 'react-intl';
import { defaultLocale, fallbackMessagesByLocale } from './locales';
import { resolveLocale } from './resolveLocale';
import { invoke } from '../ipc/client';

// Only the bundled fallback locale is available synchronously at bootstrap;
// the full, extension-backed locale list (`locales.list`) is fetched over
// IPC and only reachable once React has mounted (see `../queries/locales`).
export const locale = resolveLocale(
  Object.keys(fallbackMessagesByLocale),
  navigator.languages,
  defaultLocale,
);

const cache = createIntlCache();

export const intl = createIntl(
  {
    locale,
    defaultLocale,
    messages: fallbackMessagesByLocale[locale],
    onError: (error) => {
      if (error.code === ReactIntlErrorCode.MISSING_TRANSLATION) return;
      invoke('log.write', { level: 'warn', scope: 'intl', message: error.message }).catch(() => {});
    },
  },
  cache,
);
