import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';
import { RotateCcw, X } from 'react-feather';
import { List, ListRow, RowTitle } from '../../components/List';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { Caption } from '../../components/Caption';
import { Inline } from '../../components/Layout';
import { keyBindings, type KeyBinding } from '../../keyboard/bindings';
import {
  collidingInputs,
  effectiveKeys,
  inputLabel,
  isCustomized,
  keyChord,
  MODIFIER_KEYS,
} from '../../helpers/key';
import { gamepadInput } from '../../helpers/gamepad';
import { useGamepadButtonPresses } from '../../gamepad/useGamepadButtonPresses';
import { useKeybindingOverrides, useSetKeybindingOverride } from '../../queries/keybindings';

const messages = defineMessages({
  title: {
    id: 'settings.keybindings.title',
    defaultMessage: 'Controls',
  },
  hint: {
    id: 'settings.keybindings.hint',
    defaultMessage:
      'Click "Add" and press a button. Escape cancels. Bindings shown in red are used by more than one action.',
  },
  add: {
    id: 'settings.keybindings.add',
    defaultMessage: 'Add',
  },
  addLabel: {
    id: 'settings.keybindings.addLabel',
    defaultMessage: 'Add a binding for {name}',
  },
  remove: {
    id: 'settings.keybindings.remove',
    defaultMessage: 'Remove {binding} from {name}',
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
  saveFailed: {
    id: 'settings.keybindings.saveFailed',
    defaultMessage: 'Failed to save shortcut.',
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

const Hint = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
`;

const ErrorNote = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.danger};
`;

// Escape cancels listening and Tab is focus navigation, so neither can be bound.
const RESERVED_KEYS = new Set(['Escape', 'Tab']);

export function KeybindingsPanel(): React.JSX.Element {
  const intl = useIntl();
  const { data: overrides } = useKeybindingOverrides();
  const setOverride = useSetKeybindingOverride();
  const [listeningId, setListeningId] = useState<string | null>(null);

  function startListening(id: string): void {
    setOverride.reset();
    setListeningId(id);
  }

  function cancelListening(): void {
    setListeningId(null);
  }

  function addInput(binding: KeyBinding, input: string): void {
    setListeningId(null);
    const current = effectiveKeys(binding, overrides);
    if (current.includes(input)) return;
    setOverride.mutate({ id: binding.id, keys: [...current, input] });
  }

  function handleCapture(binding: KeyBinding, e: ReactKeyboardEvent<HTMLSpanElement>): void {
    // The captured key must not also reach the overlay's Escape handling or `useGlobalKeys`.
    e.stopPropagation();
    e.preventDefault();

    if (e.key === 'Escape') {
      cancelListening();
      return;
    }
    if (MODIFIER_KEYS.has(e.key) || RESERVED_KEYS.has(e.key)) return;

    addInput(binding, keyChord(e));
  }

  useGamepadButtonPresses((button) => {
    const binding = keyBindings.find((b) => b.id === listeningId);
    if (binding) addInput(binding, gamepadInput(button));
  }, listeningId !== null);

  function removeInput(binding: KeyBinding, input: string): void {
    setOverride.mutate({
      id: binding.id,
      keys: effectiveKeys(binding, overrides).filter((k) => k !== input),
    });
  }

  function resetBinding(id: string): void {
    setOverride.mutate({ id, keys: null });
  }

  const colliding = collidingInputs(keyBindings, overrides);

  return (
    <Section $flush>
      <SectionHeading title={<FormattedMessage {...messages.title} />} />
      <Hint>
        <FormattedMessage {...messages.hint} />
      </Hint>
      {setOverride.isError && (
        <ErrorNote>
          <FormattedMessage {...messages.saveFailed} />
        </ErrorNote>
      )}
      <List>
        {keyBindings.map((binding) => {
          const isListening = listeningId === binding.id;
          const name = intl.formatMessage(binding.label);
          const keys = effectiveKeys(binding, overrides);
          const isCustom = isCustomized(binding, overrides);

          return (
            <ListRow key={binding.id}>
              <RowTitle $size="sm">{name}</RowTitle>
              <Keys $gap={2}>
                {keys.map((input) => (
                  <Key key={input} $collides={colliding.has(input)}>
                    {inputLabel(input)}
                    <RemoveKey
                      type="button"
                      aria-label={intl.formatMessage(messages.remove, {
                        binding: inputLabel(input),
                        name,
                      })}
                      title={intl.formatMessage(messages.remove, {
                        binding: inputLabel(input),
                        name,
                      })}
                      onClick={() => removeInput(binding, input)}
                      disabled={setOverride.isPending}
                    >
                      <X size={10} />
                    </RemoveKey>
                  </Key>
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
                    onKeyDown={(e) => handleCapture(binding, e)}
                    onBlur={cancelListening}
                  >
                    <FormattedMessage {...messages.listening} />
                  </ListeningKey>
                )}
                {isCustom && !isListening && (
                  <IconButton
                    icon={RotateCcw}
                    size={14}
                    label={intl.formatMessage(messages.reset, { name })}
                    onClick={() => resetBinding(binding.id)}
                    disabled={setOverride.isPending}
                  />
                )}
                {!isListening && (
                  <Button
                    aria-label={intl.formatMessage(messages.addLabel, { name })}
                    onClick={() => startListening(binding.id)}
                    disabled={setOverride.isPending}
                  >
                    <FormattedMessage {...messages.add} />
                  </Button>
                )}
              </Keys>
            </ListRow>
          );
        })}
      </List>
    </Section>
  );
}
