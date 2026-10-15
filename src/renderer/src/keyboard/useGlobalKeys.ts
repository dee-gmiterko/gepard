import { useEffect } from 'react';
import { useCommands } from './useCommands';
import { describeTarget } from './keyTargets';
import { isInteractiveControlTarget, isTextEntryTarget } from '../helpers/eventTarget';
import { keyBindings } from './bindings';
import { useKeybindingOverrides } from '../queries/keybindings';
import { bindingMatches, keyChord } from '../helpers/key';

export function useGlobalKeys(): void {
  const commands = useCommands();
  const { data: overrides } = useKeybindingOverrides();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.target instanceof Element && e.target.closest('dialog[open]')) return;
      const target = describeTarget(e.target);
      const chord = keyChord(e);
      const binding = keyBindings.find((b) => bindingMatches(b, chord, overrides));
      if (!binding) return;
      const typing = !(e.ctrlKey || e.altKey || e.metaKey);
      if (typing && !binding.inTextEntry && target && isTextEntryTarget(target)) return;
      if (chord === ' ' && target && isInteractiveControlTarget(target)) return;
      if (binding.run(commands)) e.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commands, overrides]);
}
