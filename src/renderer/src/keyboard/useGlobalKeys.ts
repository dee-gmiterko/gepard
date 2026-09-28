import { useEffect } from 'react';
import { useCommands } from './commands';
import { describeTarget, isInteractiveControlTarget, isTextEntryTarget } from './keyTargets';
import { keyBindings } from './bindings';
import { useKeybindingOverrides } from '../queries/keybindings';
import { effectiveKey } from './effectiveKey';

export function useGlobalKeys(): void {
  const commands = useCommands();
  const { data: overrides } = useKeybindingOverrides();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.defaultPrevented || e.isComposing) return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const target = describeTarget(e.target);
      if (target && isTextEntryTarget(target)) return;
      if (e.key === ' ' && target && isInteractiveControlTarget(target)) return;

      const binding = keyBindings.find((b) => effectiveKey(b, overrides) === e.key);
      if (!binding) return;
      if (binding.run(commands)) e.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [commands, overrides]);
}
