import type { HandlerMap } from '../dispatch';
import type { SettingsStore } from '../../store/settings';

export class KeybindingsHandlers {
  constructor(private readonly settings: SettingsStore) {}

  toHandlerMap(): Pick<HandlerMap, 'keybindings.getOverrides' | 'keybindings.setOverride'> {
    return {
      'keybindings.getOverrides': () => this.settings.getKeybindingOverrides(),
      'keybindings.setOverride': ({ id, keys }) => this.settings.setKeybindingOverride(id, keys),
    };
  }
}
