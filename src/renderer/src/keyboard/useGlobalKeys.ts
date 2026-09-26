// Shell entry point (report 04 §7 item 2): a single window keydown listener
// in the bubble phase at app root, so inputs/comboboxes get first say and can
// preventDefault(). CodeMirror's content is contentEditable and is skipped
// here; the code viewer registers its own Prec.high keymap entry point that
// calls the same commands (report 04 §7 item 3; see codemirror/keymapBridge.ts).
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useCommands, type Commands } from './commands'

const NON_TEXT_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset'])

/** Text entry (comment box, search box, targeting combo boxes) keeps all
 * keys (report 04 §7); checkboxes and buttons do not, so Up/Down and Enter
 * keep working after clicking a viewed checkbox or a tab. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type)
  return target.isContentEditable
}

export function useGlobalKeys(): void {
  const commands = useCommands()
  const commandsRef = useRef<Commands>(commands)
  useLayoutEffect(() => {
    commandsRef.current = commands
  })

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.defaultPrevented || e.isComposing) return
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      if (isTextEntry(e.target)) return

      const cmds = commandsRef.current
      switch (e.key) {
        case 'Enter':
          cmds.toggleViewed()
          break
        case 'ArrowDown':
          cmds.nextFile()
          break
        case 'ArrowUp':
          cmds.prevFile()
          break
        default:
          return
      }
      e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
