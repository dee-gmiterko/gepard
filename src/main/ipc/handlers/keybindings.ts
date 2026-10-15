import type { HandlerMap } from '../registry';
import { getKeybindingOverrides, setKeybindingOverride } from '../../store/settings';

export class KeybindingsHandlers {
  toHandlerMap(): Pick<HandlerMap, 'keybindings.getOverrides' | 'keybindings.setOverride'> {
    return {
      'keybindings.getOverrides': () => getKeybindingOverrides(),
      'keybindings.setOverride': ({ id, key }) => setKeybindingOverride(id, key),
    };
  }
}
