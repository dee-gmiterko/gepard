// CodeMirror entry point for Enter/Up/Down (report 04 §7 item 3): because
// CodeMirror's content is contentEditable and is skipped by the shell's
// window keydown listener (keyboard/useGlobalKeys.ts), the viewer registers
// this Prec.high keymap calling the same commands. A getter (not the command
// object itself) is passed in so the extension can be built once per editor
// instance while always calling the latest commands, the same pattern
// useGlobalKeys.ts uses for its ref.
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
