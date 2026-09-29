// CodeMirror handles keys in its contentEditable before they reach a window
// keydown listener.
import { Prec, type Extension } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import type { Commands } from '../../keyboard/useCommands';

export function keymapBridge(getCommands: () => Commands): Extension {
  return Prec.high(
    keymap.of([
      {
        key: 'Space',
        run: () => {
          getCommands().toggleViewed();
          return true;
        },
      },
      {
        key: 'PageUp',
        run: () => {
          getCommands().prevFile();
          return true;
        },
      },
      {
        key: 'PageDown',
        run: () => {
          getCommands().nextFile();
          return true;
        },
      },
      {
        key: 'End',
        run: () => {
          getCommands().acceptNext();
          return true;
        },
      },
      {
        key: 'Home',
        run: () => {
          getCommands().revertPrev();
          return true;
        },
      },
    ]),
  );
}
