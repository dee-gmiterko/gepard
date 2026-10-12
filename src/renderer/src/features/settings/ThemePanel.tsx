import type { ChangeEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { Select } from '../../components/Select';
import { useSetThemeTemplate, useThemeTemplateId, useThemes } from '../../queries/theme';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';

const messages = defineMessages({
  title: {
    id: 'settings.theme.title',
    defaultMessage: 'Theme',
  },
  followSystem: {
    id: 'settings.theme.followSystem',
    defaultMessage: 'Follow system',
  },
  light: {
    id: 'settings.theme.light',
    defaultMessage: 'Light',
  },
  dark: {
    id: 'settings.theme.dark',
    defaultMessage: 'Dark',
  },
  lightHighContrast: {
    id: 'settings.theme.lightHighContrast',
    defaultMessage: 'Light - High contrast',
  },
  darkHighContrast: {
    id: 'settings.theme.darkHighContrast',
    defaultMessage: 'Dark - High contrast',
  },
});

const SYSTEM_OPTION = 'system';

const BUILTIN_THEME_NAMES: Record<string, MessageDescriptor> = {
  light: messages.light,
  dark: messages.dark,
  'light-high-contrast': messages.lightHighContrast,
  'dark-high-contrast': messages.darkHighContrast,
};

export function ThemePanel(): React.JSX.Element {
  const intl = useIntl();
  const { data: templateId } = useThemeTemplateId();
  const { data: themeTemplates } = useThemes();
  const setTemplate = useSetThemeTemplate();

  function handleChange(e: ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value;
    setTemplate.mutate(next === SYSTEM_OPTION ? null : next);
  }

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.title} />} />
      <Select value={templateId ?? SYSTEM_OPTION} onChange={handleChange}>
        <option value={SYSTEM_OPTION}>{intl.formatMessage(messages.followSystem)}</option>
        {(themeTemplates ?? []).map((template) => (
          <option key={template.id} value={template.id}>
            {template.id in BUILTIN_THEME_NAMES
              ? intl.formatMessage(BUILTIN_THEME_NAMES[template.id])
              : template.name}
          </option>
        ))}
      </Select>
    </Section>
  );
}
