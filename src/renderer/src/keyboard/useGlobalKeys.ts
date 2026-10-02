import { useEffect } from 'react';
import { useCommands } from './useCommands';
import { describeTarget } from './keyTargets';
import { isInteractiveControlTarget, isTextEntryTarget } from '../helpers/eventTarget';
import { keyBindings } from './bindings';
import { useKeybindingOverrides } from '../queries/keybindings';
import { effectiveKey, keyChord } from '../helpers/key';

export function useGlobalKeys(): void {
  const commands = useCommands();
  const { data: overrides } = useKeybindingOverrides();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.target instanceof Element && e.target.closest('dialog[open]')) return;
      const target = describeTarget(e.target);
      const typing = !(e.ctrlKey || e.altKey || e.metaKey);
      if (typing && target && isTextEntryTarget(target)) return;
      const chord = keyChord(e);
      if (chord === ' ' && target && isInteractiveControlTarget(target)) return;

      const binding = keyBindings.find((b) => effectiveKey(b, overrides) === chord);
      if (!binding) return;
      if (binding.run(commands)) e.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commands, overrides]);
}
