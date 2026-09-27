import { useEffect, useLayoutEffect, useRef } from 'react'
import { useCommands, type Commands } from './commands'
import { describeTarget, isInteractiveControlTarget, isTextEntryTarget } from './keyTargets'

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
      const target = describeTarget(e.target)
      if (target && isTextEntryTarget(target)) return
      if (e.key === 'Enter' && target && isInteractiveControlTarget(target)) return

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
