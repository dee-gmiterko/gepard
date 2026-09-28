import type { ChangeEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import { Select } from '../../components/Select';
import { useLocaleId, useLocales, useSetLocale } from '../../queries/locales';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';

const messages = defineMessages({
  title: {
    id: 'settings.locale.title',
    defaultMessage: 'Language',
  },
  followSystem: {
    id: 'settings.locale.followSystem',
    defaultMessage: 'Follow system',
  },
});

const SYSTEM_OPTION = 'system';

export function LocalePanel(): React.JSX.Element {
  const intl = useIntl();
  const { data: localeId } = useLocaleId();
  const { data: locales } = useLocales();
  const setLocale = useSetLocale();

  function handleChange(e: ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value;
    setLocale.mutate(next === SYSTEM_OPTION ? null : next);
  }

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.title} />} />
      <Select value={localeId ?? SYSTEM_OPTION} onChange={handleChange}>
        <option value={SYSTEM_OPTION}>{intl.formatMessage(messages.followSystem)}</option>
        {(locales ?? []).map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.displayName}
          </option>
        ))}
      </Select>
    </Section>
  );
}
