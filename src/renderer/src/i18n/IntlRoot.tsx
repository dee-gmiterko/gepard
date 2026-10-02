import { useEffect, useMemo, type ReactNode } from 'react';
import { RawIntlProvider, createIntl, createIntlCache, ReactIntlErrorCode } from 'react-intl';
import { intl as bootstrapIntl, locale as bootstrapLocale } from './intl';
import { defaultLocale } from './locales';
import { resolveLocale } from '../helpers/locale';
import { invoke } from '../ipc/client';
import { useLocaleId, useLocales } from '../queries/locales';

document.documentElement.lang = bootstrapLocale;

const cache = createIntlCache();

export function IntlRoot({ children }: { children: ReactNode }): React.JSX.Element {
  const { data: locales } = useLocales();
  const { data: localeId } = useLocaleId();

  const intl = useMemo(() => {
    if (locales === undefined || localeId === undefined) return bootstrapIntl;

    const messagesById = Object.fromEntries(locales.map((l) => [l.id, l.messages]));
    const availableIds = Object.keys(messagesById);
    if (availableIds.length === 0) return bootstrapIntl;

    const preferred = localeId !== null ? [localeId, ...navigator.languages] : navigator.languages;
    const resolved = resolveLocale(availableIds, preferred, defaultLocale);

    return createIntl(
      {
        locale: resolved,
        defaultLocale,
        messages: messagesById[resolved] ?? {},
        onError: (error) => {
          if (error.code === ReactIntlErrorCode.MISSING_TRANSLATION) return;
          invoke('log.write', { level: 'warn', scope: 'intl', message: error.message }).catch(
            () => {},
          );
        },
      },
      cache,
    );
  }, [locales, localeId]);

  useEffect(() => {
    document.documentElement.lang = intl.locale;
  }, [intl]);

  return <RawIntlProvider value={intl}>{children}</RawIntlProvider>;
}
