import { useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { defineMessages, FormattedMessage, useIntl } from 'react-intl';
import styled from 'styled-components';
import { RotateCcw } from 'react-feather';
import { List, ListRow, RowTitle } from '../../components/List';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { Caption } from '../../components/Caption';
import { Inline, Stack } from '../../components/Layout';
import { keyBindings, type KeyBinding } from '../../keyboard/bindings';
import { effectiveKey } from '../../keyboard/effectiveKey';
import { keyLabel } from '../../keyboard/keyLabel';
import { useKeybindingOverrides, useSetKeybindingOverride } from '../../queries/keybindings';

const messages = defineMessages({
  title: {
    id: 'settings.keybindings.title',
    defaultMessage: 'Controls',
  },
  hint: {
    id: 'settings.keybindings.hint',
    defaultMessage: 'Click "Rebind" and press a key. Escape cancels.',
  },
  rebind: {
    id: 'settings.keybindings.rebind',
    defaultMessage: 'Rebind',
  },
  rebindLabel: {
    id: 'settings.keybindings.rebindLabel',
    defaultMessage: 'Rebind {name}',
  },
  listening: {
    id: 'settings.keybindings.listening',
    defaultMessage: 'Press a key…',
  },
  reset: {
    id: 'settings.keybindings.reset',
    defaultMessage: 'Reset {name} to default',
  },
  customized: {
    id: 'settings.keybindings.customized',
    defaultMessage: 'Customized',
  },
  conflict: {
    id: 'settings.keybindings.conflict',
    defaultMessage: 'Also used by {name}',
  },
  saveFailed: {
    id: 'settings.keybindings.saveFailed',
    defaultMessage: 'Failed to save shortcut.',
  },
});

const Key = styled(Badge)`
  font-family: ${({ theme }) => theme.font.mono};
`;

const ListeningKey = styled(Badge)`
  font-family: ${({ theme }) => theme.font.mono};
  border-color: ${({ theme }) => theme.colors.accent};
  color: ${({ theme }) => theme.colors.accent};
`;

const Hint = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
`;

const ConflictNote = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.danger};
`;

// Keys that must stay reserved so a binding can never be rebound onto
// something that would break other keyboard interaction (closing the
// listening state itself, or basic focus navigation).
const RESERVED_KEYS = new Set(['Escape', 'Tab']);

function conflictsFor(
  binding: KeyBinding,
  key: string,
  overrides: Record<string, string> | undefined,
): KeyBinding[] {
  return keyBindings.filter((b) => b.id !== binding.id && effectiveKey(b, overrides) === key);
}

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

  function handleCapture(binding: KeyBinding, e: ReactKeyboardEvent<HTMLSpanElement>): void {
    // Stop this from reaching the settings overlay's own Escape/Tab handling
    // and from reaching `useGlobalKeys`' window-level listener - the
    // captured key must be consumed here, not also trigger a shortcut or
    // close the overlay.
    e.stopPropagation();
    e.preventDefault();

    if (e.key === 'Escape') {
      cancelListening();
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (RESERVED_KEYS.has(e.key)) return;

    setListeningId(null);
    setOverride.mutate({ id: binding.id, key: e.key });
  }

  function resetBinding(id: string): void {
    setOverride.mutate({ id, key: null });
  }

  return (
    <Section>
      <SectionHeading title={<FormattedMessage {...messages.title} />} />
      <Hint>
        <FormattedMessage {...messages.hint} />
      </Hint>
      {setOverride.isError && (
        <ConflictNote>
          <FormattedMessage {...messages.saveFailed} />
        </ConflictNote>
      )}
      <List>
        {keyBindings.map((binding) => {
          const isListening = listeningId === binding.id;
          const key = effectiveKey(binding, overrides);
          const isCustom = Boolean(overrides?.[binding.id]);
          const conflicts = conflictsFor(binding, key, overrides);

          return (
            <ListRow key={binding.id}>
              <Stack $gap={1}>
                <RowTitle $size="sm">{intl.formatMessage(binding.label)}</RowTitle>
                {conflicts.length > 0 && (
                  <ConflictNote>
                    <FormattedMessage
                      {...messages.conflict}
                      values={{
                        name: conflicts.map((c) => intl.formatMessage(c.label)).join(', '),
                      }}
                    />
                  </ConflictNote>
                )}
              </Stack>
              <Inline $gap={2}>
                {isListening ? (
                  <ListeningKey
                    tabIndex={0}
                    ref={(el) => el?.focus()}
                    role="button"
                    aria-label={intl.formatMessage(messages.rebindLabel, {
                      name: intl.formatMessage(binding.label),
                    })}
                    onKeyDown={(e) => handleCapture(binding, e)}
                    onBlur={cancelListening}
                  >
                    <FormattedMessage {...messages.listening} />
                  </ListeningKey>
                ) : (
                  <>
                    {isCustom && (
                      <Badge $tone="muted">{intl.formatMessage(messages.customized)}</Badge>
                    )}
                    <Key>{isCustom ? keyLabel(key) : binding.keyLabel}</Key>
                  </>
                )}
                {isCustom && !isListening && (
                  <IconButton
                    icon={RotateCcw}
                    size={14}
                    label={intl.formatMessage(messages.reset, {
                      name: intl.formatMessage(binding.label),
                    })}
                    onClick={() => resetBinding(binding.id)}
                    disabled={setOverride.isPending}
                  />
                )}
                {!isListening && (
                  <Button
                    onClick={() => startListening(binding.id)}
                    disabled={setOverride.isPending}
                  >
                    <FormattedMessage {...messages.rebind} />
                  </Button>
                )}
              </Inline>
            </ListRow>
          );
        })}
      </List>
    </Section>
  );
}
