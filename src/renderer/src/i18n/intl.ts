import { createIntl, createIntlCache, ReactIntlErrorCode } from 'react-intl';
import { defaultLocale } from './locales';
import { invoke } from '../ipc/client';

export const locale = defaultLocale;

const cache = createIntlCache();

export const intl = createIntl(
  {
    locale,
    defaultLocale,
    messages: {},
    onError: (error) => {
      if (error.code === ReactIntlErrorCode.MISSING_TRANSLATION) return;
      invoke('log.write', { level: 'warn', scope: 'intl', message: error.message }).catch(() => {});
    },
  },
  cache,
);
