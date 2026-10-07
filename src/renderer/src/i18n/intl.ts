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

let activeIntl: IntlShape = buildIntl(defaultLocale, {});

// Owned by IntlRoot; code outside the React tree reads the active translator through getIntl.
export function setActiveIntl(intl: IntlShape): void {
  activeIntl = intl;
}

export function getIntl(): IntlShape {
  return activeIntl;
}
