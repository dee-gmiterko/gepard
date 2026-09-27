import type { KeyboardEvent } from 'react'
import styled from 'styled-components'
import { FormattedMessage, useIntl } from 'react-intl'
import { defineMessages } from '../../i18n/defineMessages'
import { activeToggleBackground } from '../IconButton'

export type SearchScope = 'all' | 'targeted'

const messages = defineMessages({
  ariaLabel: {
    id: 'components.scopeToggle.ariaLabel',
    defaultMessage: 'Search scope'
  },
  all: {
    id: 'components.scopeToggle.all',
    defaultMessage: 'All files'
  },
  targetedOnly: {
    id: 'components.scopeToggle.targetedOnly',
    defaultMessage: 'Targeted only'
  }
})

const Group = styled.div`
  display: inline-flex;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
  flex-shrink: 0;
`

const Option = styled.button<{ $active: boolean }>`
  border: none;
  padding: 2px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;
  color: ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.fgMuted)};
  ${activeToggleBackground}
`

// In the ARIA radio group pattern, arrow keys move both focus and selection.
function moveTo(
  scope: SearchScope,
  onChange: (scope: SearchScope) => void,
  e: KeyboardEvent
): void {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  e.preventDefault()
  onChange(scope)
  const current = e.currentTarget as HTMLElement
  const sibling = (current.nextElementSibling ??
    current.previousElementSibling) as HTMLElement | null
  sibling?.focus()
}

export function ScopeToggle({
  value,
  onChange
}: {
  value: SearchScope
  onChange: (scope: SearchScope) => void
}): React.JSX.Element {
  const intl = useIntl()
  return (
    <Group role="radiogroup" aria-label={intl.formatMessage(messages.ariaLabel)}>
      <Option
        type="button"
        role="radio"
        aria-checked={value === 'all'}
        tabIndex={value === 'all' ? 0 : -1}
        $active={value === 'all'}
        onClick={() => onChange('all')}
        onKeyDown={(e) => moveTo('targeted', onChange, e)}
      >
        <FormattedMessage {...messages.all} />
      </Option>
      <Option
        type="button"
        role="radio"
        aria-checked={value === 'targeted'}
        tabIndex={value === 'targeted' ? 0 : -1}
        $active={value === 'targeted'}
        onClick={() => onChange('targeted')}
        onKeyDown={(e) => moveTo('all', onChange, e)}
      >
        <FormattedMessage {...messages.targetedOnly} />
      </Option>
    </Group>
  )
}
