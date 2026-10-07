import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import { RawIntlProvider } from 'react-intl';
import { buildIntl, getIntl, setActiveIntl } from './intl';
import { defaultLocale } from './locales';
import { resolveLocale } from '../helpers/locale';
import { useLocaleId, useLocales } from '../queries/locales';

document.documentElement.lang = getIntl().locale;

export function IntlRoot({ children }: { children: ReactNode }): React.JSX.Element {
  const { data: locales } = useLocales();
  const { data: localeId } = useLocaleId();

  const intl = useMemo(() => {
    if (locales === undefined || localeId === undefined) return getIntl();

    const messagesById = Object.fromEntries(locales.map((l) => [l.id, l.messages]));
    const availableIds = Object.keys(messagesById);
    if (availableIds.length === 0) return getIntl();

    const preferred = localeId !== null ? [localeId, ...navigator.languages] : navigator.languages;
    const resolved = resolveLocale(availableIds, preferred, defaultLocale);

    return buildIntl(resolved, messagesById[resolved] ?? {});
  }, [locales, localeId]);

  useLayoutEffect(() => {
    setActiveIntl(intl);
    document.documentElement.lang = intl.locale;
  }, [intl]);

  return <RawIntlProvider value={intl}>{children}</RawIntlProvider>;
}
