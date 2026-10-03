import { useId } from 'react';
import styled from 'styled-components';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import type { SearchScope } from '@gepard/common';
import { activeToggleBackground } from './controlStyles';

const messages = defineMessages({
  ariaLabel: {
    id: 'components.scopeToggle.ariaLabel',
    defaultMessage: 'Search scope',
  },
  all: {
    id: 'components.scopeToggle.all',
    defaultMessage: 'All files',
  },
  targetedOnly: {
    id: 'components.scopeToggle.targetedOnly',
    defaultMessage: 'Targeted only',
  },
});

const Group = styled.fieldset`
  display: inline-flex;
  margin: 0;
  padding: 0;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.sm};
  overflow: hidden;
  flex-shrink: 0;
`;

const Option = styled.label<{ $active: boolean }>`
  position: relative;
  padding: 2px ${({ theme }) => theme.space[2]};
  font-size: ${({ theme }) => theme.font.size.xs};
  cursor: pointer;
  color: ${({ $active, theme }) => ($active ? theme.colors.accent : theme.colors.fgMuted)};
  ${activeToggleBackground}

  &:has(:focus-visible) {
    outline: 2px solid ${({ theme }) => theme.colors.accent};
    outline-offset: -2px;
  }
`;

const Radio = styled.input`
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: inherit;
`;

export function ScopeToggle({
  value,
  onChange,
}: {
  value: SearchScope;
  onChange: (scope: SearchScope) => void;
}): React.JSX.Element {
  const intl = useIntl();
  const name = useId();
  const options: { scope: SearchScope; label: MessageDescriptor }[] = [
    { scope: 'all', label: messages.all },
    { scope: 'targeted', label: messages.targetedOnly },
  ];
  return (
    <Group aria-label={intl.formatMessage(messages.ariaLabel)}>
      {options.map(({ scope, label }) => (
        <Option key={scope} $active={value === scope}>
          <Radio
            type="radio"
            name={name}
            value={scope}
            checked={value === scope}
            onChange={() => onChange(scope)}
          />
          <FormattedMessage {...label} />
        </Option>
      ))}
    </Group>
  );
}
