import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { Commands } from './useCommands';
import type { Modifier } from '../helpers/key';

const MOD: Modifier =
  typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Meta' : 'Ctrl';

export interface KeyBinding {
  id: string;
  key: string;
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
  acceptNext: {
    id: 'keyboard.acceptNext',
    defaultMessage: 'Mark viewed and go to next file',
  },
  revertPrev: {
    id: 'keyboard.revertPrev',
    defaultMessage: 'Unmark last accepted file and go back to it',
  },
  showFiles: {
    id: 'keyboard.showFiles',
    defaultMessage: 'Show file browser',
  },
  showTargeted: {
    id: 'keyboard.showTargeted',
    defaultMessage: 'Show targeted files',
  },
  showSearch: {
    id: 'keyboard.showSearch',
    defaultMessage: 'Show search',
  },
  quickSearchFile: {
    id: 'keyboard.quickSearchFile',
    defaultMessage: 'Find in the active file',
  },
  toggleWrapLines: {
    id: 'keyboard.toggleWrapLines',
    defaultMessage: 'Toggle wrapping of long lines in the code viewer',
  },
  quickSearchNavigate: {
    id: 'keyboard.quickSearchNavigate',
    defaultMessage: 'Go to file or symbol',
  },
});

export const keyBindings: readonly KeyBinding[] = [
  {
    id: 'toggleViewed',
    key: ' ',
    label: messages.toggleViewed,
    run: (commands) => commands.toggleViewed(),
  },
  {
    id: 'nextFile',
    key: 'PageDown',
    label: messages.nextFile,
    run: (commands) => commands.nextFile(),
  },
  {
    id: 'prevFile',
    key: 'PageUp',
    label: messages.prevFile,
    run: (commands) => commands.prevFile(),
  },
  {
    id: 'acceptNext',
    key: 'End',
    label: messages.acceptNext,
    run: (commands) => commands.acceptNext(),
  },
  {
    id: 'revertPrev',
    key: 'Home',
    label: messages.revertPrev,
    run: (commands) => commands.revertPrev(),
  },
  {
    id: 'showFiles',
    key: `${MOD}+Shift+E`,
    label: messages.showFiles,
    run: (commands) => commands.showSidePanelTab('files'),
  },
  {
    id: 'showTargeted',
    key: `${MOD}+Shift+G`,
    label: messages.showTargeted,
    run: (commands) => commands.showSidePanelTab('targeted'),
  },
  {
    id: 'showSearch',
    key: `${MOD}+Shift+F`,
    label: messages.showSearch,
    run: (commands) => commands.showSidePanelTab('search'),
  },
  {
    id: 'quickSearchFile',
    key: `${MOD}+F`,
    label: messages.quickSearchFile,
    run: (commands) => commands.openQuickSearch('file'),
  },
  {
    id: 'quickSearchNavigate',
    key: `${MOD}+P`,
    label: messages.quickSearchNavigate,
    run: (commands) => commands.openQuickSearch('navigate'),
  },
  {
    id: 'toggleWrapLines',
    key: `${MOD}+Shift+L`,
    label: messages.toggleWrapLines,
    run: (commands) => commands.toggleWrapLines(),
  },
];
