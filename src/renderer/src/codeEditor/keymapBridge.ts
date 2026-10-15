import { Prec, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { keyBindings } from '../keyboard/bindings';
import type { Commands } from '../keyboard/useCommands';
import { bindingMatches, keyChord, type KeybindingOverrides } from '../helpers/key';

// CodeMirror handles keys in its contentEditable before they reach a window
// keydown listener.

export function keymapBridge(
  getCommands: () => Commands,
  getOverrides: () => KeybindingOverrides | undefined,
): Extension {
  return Prec.high(
    EditorView.domEventHandlers({
      keydown: (e) => {
        if (e.isComposing) return false;
        const chord = keyChord(e);
        const binding = keyBindings.find((b) => bindingMatches(b, chord, getOverrides()));
        return binding ? binding.run(getCommands()) : false;
      },
    }),
  );
}
