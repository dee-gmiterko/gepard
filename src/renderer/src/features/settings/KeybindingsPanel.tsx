import { useState } from 'react';
import { defineMessages, FormattedMessage } from 'react-intl';
import styled from 'styled-components';
import { List } from '../../components/List';
import { Section } from '../../components/Section';
import { SectionHeading } from '../../components/SectionHeading';
import { Caption } from '../../components/Caption';
import { keyBindings, type KeyBinding } from '../../keyboard/bindings';
import { collidingInputs, effectiveKeys, isCustomized } from '../../helpers/key';
import { gamepadInput } from '../../helpers/gamepad';
import { useGamepadButtonPresses } from '../../gamepad/useGamepadButtonPresses';
import { useKeybindingOverrides, useSetKeybindingOverride } from '../../queries/keybindings';
import { KeybindingsRow } from './KeybindingsRow';

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
  saveFailed: {
    id: 'settings.keybindings.saveFailed',
    defaultMessage: 'Failed to save shortcut.',
  },
});

const Hint = styled(Caption)`
  display: block;
  margin-bottom: ${({ theme }) => theme.space[2]};
`;

const ErrorNote = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.colors.danger};
`;

export function KeybindingsPanel(): React.JSX.Element {
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
        {keyBindings.map((binding) => (
          <KeybindingsRow
            key={binding.id}
            binding={binding}
            keys={effectiveKeys(binding, overrides)}
            colliding={colliding}
            isCustom={isCustomized(binding, overrides)}
            isListening={listeningId === binding.id}
            disabled={setOverride.isPending}
            onStartListening={() => startListening(binding.id)}
            onCancelListening={cancelListening}
            onAdd={(input) => addInput(binding, input)}
            onRemove={(input) => removeInput(binding, input)}
            onReset={() => resetBinding(binding.id)}
          />
        ))}
      </List>
    </Section>
  );
}
