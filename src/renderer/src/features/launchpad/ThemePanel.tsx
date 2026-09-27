import type { ChangeEvent } from 'react'
import { FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { Select } from '../../components/Select'
import { themeTemplates, type ThemeTemplate } from '../../theme/templates'
import { SYSTEM_DARK_TEMPLATE_ID, SYSTEM_LIGHT_TEMPLATE_ID } from '../../theme/resolveTemplate'
import { useSetThemeTemplate, useThemeTemplateId } from '../../queries/theme'
import { Section } from '../../components/Section'
import { SectionHeading } from '../../components/SectionHeading'

const messages = defineMessages({
  title: {
    id: 'launchpad.theme.title',
    defaultMessage: 'Theme'
  },
  followSystem: {
    id: 'launchpad.theme.followSystem',
    defaultMessage: 'Follow system'
  },
  light: {
    id: 'launchpad.theme.light',
    defaultMessage: 'Light'
  },
  dark: {
    id: 'launchpad.theme.dark',
    defaultMessage: 'Dark'
  }
})

const builtinTemplateNames: Record<string, MessageDescriptor> = {
  [SYSTEM_LIGHT_TEMPLATE_ID]: messages.light,
  [SYSTEM_DARK_TEMPLATE_ID]: messages.dark
}

const SYSTEM_OPTION = 'system'

export function ThemePanel(): React.JSX.Element {
  const intl = useIntl()
  const { data: templateId } = useThemeTemplateId()
  const setTemplate = useSetThemeTemplate()

  function handleChange(e: ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value
    setTemplate.mutate(next === SYSTEM_OPTION ? null : next)
  }

  function templateLabel(template: ThemeTemplate): string {
    const message = builtinTemplateNames[template.id]
    return message ? intl.formatMessage(message) : template.name
  }

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.title} />} />
      <Select value={templateId ?? SYSTEM_OPTION} onChange={handleChange}>
        <option value={SYSTEM_OPTION}>{intl.formatMessage(messages.followSystem)}</option>
        {themeTemplates.map((template) => (
          <option key={template.id} value={template.id}>
            {templateLabel(template)}
          </option>
        ))}
      </Select>
    </Section>
  )
}
