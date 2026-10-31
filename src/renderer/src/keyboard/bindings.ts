import { defineMessages, type MessageDescriptor } from 'react-intl';
import type { Commands } from './useCommands';
import type { Modifier } from '../helpers/key';

const MOD: Modifier =
  typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Meta' : 'Ctrl';

export interface KeyBinding {
  id: string;
  keys: readonly string[];
  label: MessageDescriptor;
  inTextEntry?: boolean;
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
  toggleFullFileDiff: {
    id: 'keyboard.toggleFullFileDiff',
    defaultMessage: 'Toggle showing the full file with changes instead of changes only',
  },
  submitComment: {
    id: 'keyboard.submitComment',
    defaultMessage: 'Submit the comment being written',
  },
  findNext: {
    id: 'keyboard.findNext',
    defaultMessage: 'Go to the next match while finding in the active file',
  },
  findPrevious: {
    id: 'keyboard.findPrevious',
    defaultMessage: 'Go to the previous match while finding in the active file',
  },
  quickSearchNavigate: {
    id: 'keyboard.quickSearchNavigate',
    defaultMessage: 'Go to file or symbol',
  },
  sync: {
    id: 'keyboard.sync',
    defaultMessage: 'Sync with the remote',
  },
});

export const keyBindings: readonly KeyBinding[] = [
  {
    id: 'toggleViewed',
    keys: [' '],
    label: messages.toggleViewed,
    run: (commands) => commands.toggleViewed(),
  },
  {
    id: 'nextFile',
    keys: ['PageDown'],
    label: messages.nextFile,
    run: (commands) => commands.nextFile(),
  },
  {
    id: 'prevFile',
    keys: ['PageUp'],
    label: messages.prevFile,
    run: (commands) => commands.prevFile(),
  },
  {
    id: 'acceptNext',
    keys: ['End'],
    label: messages.acceptNext,
    run: (commands) => commands.acceptNext(),
  },
  {
    id: 'revertPrev',
    keys: ['Home'],
    label: messages.revertPrev,
    run: (commands) => commands.revertPrev(),
  },
  {
    id: 'showFiles',
    keys: [`${MOD}+Shift+E`],
    label: messages.showFiles,
    run: (commands) => commands.showSidePanelTab('files'),
  },
  {
    id: 'showTargeted',
    keys: [`${MOD}+Shift+G`],
    label: messages.showTargeted,
    run: (commands) => commands.showSidePanelTab('targeted'),
  },
  {
    id: 'showSearch',
    keys: [`${MOD}+Shift+F`],
    label: messages.showSearch,
    run: (commands) => commands.showSidePanelTab('search'),
  },
  {
    id: 'quickSearchFile',
    keys: [`${MOD}+F`],
    label: messages.quickSearchFile,
    run: (commands) => commands.openQuickSearch('file'),
  },
  {
    id: 'quickSearchNavigate',
    keys: [`${MOD}+P`],
    label: messages.quickSearchNavigate,
    run: (commands) => commands.openQuickSearch('navigate'),
  },
  {
    id: 'toggleWrapLines',
    keys: [`${MOD}+Shift+L`],
    label: messages.toggleWrapLines,
    run: (commands) => commands.toggleWrapLines(),
  },
  {
    id: 'toggleFullFileDiff',
    keys: [`${MOD}+Shift+D`],
    label: messages.toggleFullFileDiff,
    run: (commands) => commands.toggleFullFileDiff(),
  },
  {
    id: 'submitComment',
    keys: [`${MOD}+Enter`],
    label: messages.submitComment,
    run: (commands) => commands.submitComment(),
  },
  {
    id: 'findNext',
    keys: ['Enter', 'F3', 'ArrowDown'],
    label: messages.findNext,
    inTextEntry: true,
    run: (commands) => commands.findNext(),
  },
  {
    id: 'findPrevious',
    keys: ['Shift+Enter', 'Shift+F3', 'ArrowUp'],
    label: messages.findPrevious,
    inTextEntry: true,
    run: (commands) => commands.findPrevious(),
  },
  {
    id: 'sync',
    keys: [],
    label: messages.sync,
    run: (commands) => commands.sync(),
  },
];
