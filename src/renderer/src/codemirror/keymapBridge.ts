// CodeMirror's content is contentEditable, so the shell's window keydown
// listener never sees these keys; Prec.high registers this keymap ahead of
// CodeMirror's own bindings. A getter, not the command object itself, is
// passed in because CodeMirror extensions are captured once when the editor
// is created, so a plain closure over `commands` would go stale.
import { Prec, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import type { Commands } from '../keyboard/commands'

export function keymapBridge(getCommands: () => Commands): Extension {
  return Prec.high(
    keymap.of([
      {
        key: 'Enter',
        run: () => {
          getCommands().toggleViewed()
          return true
        }
      },
      {
        key: 'ArrowUp',
        run: () => {
          getCommands().prevFile()
          return true
        }
      },
      {
        key: 'ArrowDown',
        run: () => {
          getCommands().nextFile()
          return true
        }
      }
    ])
  )
}
