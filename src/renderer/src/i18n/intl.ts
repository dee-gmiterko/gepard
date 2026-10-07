import { createIntl, createIntlCache, ReactIntlErrorCode, type IntlShape } from 'react-intl';
import { defaultLocale } from './locales';
import { invoke } from '../ipc/client';

const cache = createIntlCache();

export function buildIntl(locale: string, messages: Record<string, string>): IntlShape {
  return createIntl(
    {
      locale,
      defaultLocale,
      messages,
      onError: (error) => {
        if (error.code === ReactIntlErrorCode.MISSING_TRANSLATION) return;
        invoke('log.write', { level: 'warn', scope: 'intl', message: error.message }).catch(
          () => {},
        );
      },
    },
    cache,
  );
}
