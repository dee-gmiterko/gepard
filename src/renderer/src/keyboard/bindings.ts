import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { Commands } from './commands';

// The single source of truth for global keyboard shortcuts: both the runtime
// handler (`useGlobalKeys`) and the settings screen's read-only bindings list
// are built from this table, so the two can never drift apart. Rebinding is
// not supported yet - each entry's `key` is what `useGlobalKeys` matches
// against `KeyboardEvent.key`, not a user-configurable value.
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
