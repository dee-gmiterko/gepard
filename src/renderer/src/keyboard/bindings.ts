import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { Commands } from './commands';

// The single source of truth for global keyboard shortcuts: both the runtime
// handler (`useGlobalKeys`) and the settings screen's bindings list are built
// from this table, so the two can never drift apart. Each entry's `key` is
// only the *default* - the effective key (what `useGlobalKeys` actually
// matches against `KeyboardEvent.key`) is resolved via `effectiveKey`, which
// applies a persisted override from `keybindings.getOverrides` when one
// exists for that binding id. See `KeybindingsPanel` for the rebind UI.
export interface KeyBinding {
  id: string;
  key: string;
  keyLabel: string;
  label: MessageDescriptor;
  run: (commands: Commands) => boolean;
}

const messages = defineMessages({
  toggleViewed: {
    id: 'keyboard.toggleViewed',
    defaultMessage: 'Toggle viewed state',
  },
  nextFile: {
    id: 'keyboard.nextFile',
    defaultMessage: 'Next file in targeted list (skips viewed)',
  },
  prevFile: {
    id: 'keyboard.prevFile',
    defaultMessage: 'Previous file in targeted list (skips viewed)',
  },
});

export const keyBindings: readonly KeyBinding[] = [
  {
    id: 'toggleViewed',
    key: ' ',
    keyLabel: 'Space',
    label: messages.toggleViewed,
    run: (commands) => commands.toggleViewed(),
  },
  {
    id: 'nextFile',
    key: 'PageDown',
    keyLabel: 'Page Down',
    label: messages.nextFile,
    run: (commands) => commands.nextFile(),
  },
  {
    id: 'prevFile',
    key: 'PageUp',
    keyLabel: 'Page Up',
    label: messages.prevFile,
    run: (commands) => commands.prevFile(),
  },
];
