import type { HandlerMap } from '../registry';
import { getKeybindingOverrides, setKeybindingOverride } from '../../store/settings';

export const keybindingsHandlers: Pick<
  HandlerMap,
  'keybindings.getOverrides' | 'keybindings.setOverride'
> = {
  'keybindings.getOverrides': () => getKeybindingOverrides(),
  'keybindings.setOverride': ({ id, key }) => setKeybindingOverride(id, key),
};
