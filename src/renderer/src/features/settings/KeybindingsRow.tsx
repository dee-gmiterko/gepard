import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';
import { RotateCcw } from 'react-feather';
import { ListRow, RowTitle } from '../../components/List';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { Caption } from '../../components/Caption';
import { Inline } from '../../components/Layout';
import type { KeyBinding } from '../../keyboard/bindings';
import { keyChord, MODIFIER_KEYS } from '../../helpers/key';
import { KeybindingKey } from './KeybindingKey';

const messages = defineMessages({
  add: {
    id: 'settings.keybindings.add',
    defaultMessage: 'Add',
  },
  addLabel: {
    id: 'settings.keybindings.addLabel',
    defaultMessage: 'Add a binding for {name}',
  },
  unbound: {
    id: 'settings.keybindings.unbound',
    defaultMessage: 'Not bound',
  },
  listening: {
    id: 'settings.keybindings.listening',
    defaultMessage: 'Press a button…',
  },
  reset: {
    id: 'settings.keybindings.reset',
    defaultMessage: 'Reset {name} to default',
  },
});

const Keys = styled(Inline)`
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const ListeningKey = styled(Badge)`
  font-family: ${({ theme }) => theme.font.mono};
  border-color: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.accent};
`;

const Unbound = styled(Caption)`
  font-style: italic;
`;

// Escape cancels listening and Tab is focus navigation, so neither can be bound.
const RESERVED_KEYS = new Set(['Escape', 'Tab']);

export function KeybindingsRow({
  binding,
  keys,
  colliding,
  isCustom,
  isListening,
  disabled,
  onStartListening,
  onCancelListening,
  onAdd,
  onRemove,
  onReset,
}: {
  binding: KeyBinding;
  keys: readonly string[];
  colliding: ReadonlySet<string>;
  isCustom: boolean;
  isListening: boolean;
  disabled: boolean;
  onStartListening: () => void;
  onCancelListening: () => void;
  onAdd: (input: string) => void;
  onRemove: (input: string) => void;
  onReset: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const name = intl.formatMessage(binding.label);

  function handleCapture(e: ReactKeyboardEvent<HTMLSpanElement>): void {
    // The captured key must not also reach the overlay's Escape handling or `useGlobalKeys`.
    e.stopPropagation();
    e.preventDefault();

    if (e.key === 'Escape') {
      onCancelListening();
      return;
    }
    if (MODIFIER_KEYS.has(e.key) || RESERVED_KEYS.has(e.key)) return;

    onAdd(keyChord(e));
  }

  return (
    <ListRow>
      <RowTitle $size="sm">{name}</RowTitle>
      <Keys $gap={2}>
        {keys.map((input) => (
          <KeybindingKey
            key={input}
            input={input}
            name={name}
            collides={colliding.has(input)}
            disabled={disabled}
            onRemove={() => onRemove(input)}
          />
        ))}
        {keys.length === 0 && !isListening && (
          <Unbound>
            <FormattedMessage {...messages.unbound} />
          </Unbound>
        )}
        {isListening && (
          <ListeningKey
            tabIndex={0}
            ref={(el) => el?.focus()}
            role="button"
            aria-label={intl.formatMessage(messages.addLabel, { name })}
            onKeyDown={handleCapture}
            onBlur={onCancelListening}
          >
            <FormattedMessage {...messages.listening} />
          </ListeningKey>
        )}
        {isCustom && !isListening && (
          <IconButton
            icon={RotateCcw}
            size={14}
            label={intl.formatMessage(messages.reset, { name })}
            onClick={onReset}
            disabled={disabled}
          />
        )}
        {!isListening && (
          <Button
            aria-label={intl.formatMessage(messages.addLabel, { name })}
            onClick={onStartListening}
            disabled={disabled}
          >
            <FormattedMessage {...messages.add} />
          </Button>
        )}
      </Keys>
    </ListRow>
  );
}
