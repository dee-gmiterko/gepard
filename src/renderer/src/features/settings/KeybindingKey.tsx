import { defineMessages, useIntl } from 'react-intl';
import styled from 'styled-components';
import { X } from 'react-feather';
import { Badge } from '../../components/Badge';
import { inputLabel } from '../../helpers/key';

const messages = defineMessages({
  remove: {
    id: 'settings.keybindings.remove',
    defaultMessage: 'Remove {binding} from {name}',
  },
});

const Key = styled(Badge)<{ $collides: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.space[1]};
  font-family: ${({ theme }) => theme.font.mono};
  ${({ $collides, theme }) =>
    $collides ? `background: ${theme.colors.diffDelBg}; color: ${theme.colors.diffDelFg};` : ''}
`;

const RemoveKey = styled.button`
  display: inline-flex;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;

  &:hover,
  &:focus-visible {
    opacity: 1;
  }
`;

export function KeybindingKey({
  input,
  name,
  collides,
  disabled,
  onRemove,
}: {
  input: string;
  name: string;
  collides: boolean;
  disabled: boolean;
  onRemove: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const label = intl.formatMessage(messages.remove, { binding: inputLabel(input), name });

  return (
    <Key $collides={collides}>
      {inputLabel(input)}
      <RemoveKey
        type="button"
        aria-label={label}
        title={label}
        onClick={onRemove}
        disabled={disabled}
      >
        <X size={10} />
      </RemoveKey>
    </Key>
  );
}
