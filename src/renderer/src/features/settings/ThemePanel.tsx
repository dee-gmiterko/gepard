import type { ChangeEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { Select } from '../../components/Select';
import type { ThemeTemplate } from '../../theme/tokens';
import { SYSTEM_DARK_TEMPLATE_ID, SYSTEM_LIGHT_TEMPLATE_ID } from '../../theme/resolveTemplate';
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
});

const builtinTemplateNames: Record<string, MessageDescriptor> = {
  [SYSTEM_LIGHT_TEMPLATE_ID]: messages.light,
  [SYSTEM_DARK_TEMPLATE_ID]: messages.dark,
};

const SYSTEM_OPTION = 'system';

export function ThemePanel(): React.JSX.Element {
  const intl = useIntl();
  const { data: templateId } = useThemeTemplateId();
  const { data: themeTemplates } = useThemes();
  const setTemplate = useSetThemeTemplate();

  function handleChange(e: ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value;
    setTemplate.mutate(next === SYSTEM_OPTION ? null : next);
  }

  function templateLabel(template: ThemeTemplate): string {
    const message = builtinTemplateNames[template.id];
    return message ? intl.formatMessage(message) : template.name;
  }

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.title} />} />
      <Select value={templateId ?? SYSTEM_OPTION} onChange={handleChange}>
        <option value={SYSTEM_OPTION}>{intl.formatMessage(messages.followSystem)}</option>
        {(themeTemplates ?? []).map((template) => (
          <option key={template.id} value={template.id}>
            {templateLabel(template)}
          </option>
        ))}
      </Select>
    </Section>
  );
}
