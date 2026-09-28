import type { ReactNode } from 'react';
import { RawIntlProvider } from 'react-intl';
import { intl, locale } from './intl';

document.documentElement.lang = locale;

export function IntlRoot({ children }: { children: ReactNode }): React.JSX.Element {
  return <RawIntlProvider value={intl}>{children}</RawIntlProvider>;
}
