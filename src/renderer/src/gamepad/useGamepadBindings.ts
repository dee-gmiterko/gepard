import { useCommands } from '../keyboard/useCommands';
import { keyBindings } from '../keyboard/bindings';
import { useKeybindingOverrides } from '../queries/keybindings';
import { bindingMatches } from '../helpers/key';
import { gamepadInput } from '../helpers/gamepad';
import { useGamepadButtonPresses } from './useGamepadButtonPresses';

export function useGamepadBindings(): void {
  const commands = useCommands();
  const { data: overrides } = useKeybindingOverrides();

  useGamepadButtonPresses((button) => {
    if (document.querySelector('dialog[open]')) return;
    const input = gamepadInput(button);
    keyBindings.find((b) => bindingMatches(b, input, overrides))?.run(commands);
  });
}
