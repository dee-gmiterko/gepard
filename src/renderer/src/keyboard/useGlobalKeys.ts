import { useEffect } from 'react'
import { useCommands } from './commands'
import { describeTarget, isInteractiveControlTarget, isTextEntryTarget } from './keyTargets'

export function useGlobalKeys(): void {
  const commands = useCommands()

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.defaultPrevented || e.isComposing) return
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const target = describeTarget(e.target)
      if (target && isTextEntryTarget(target)) return
      if (e.key === ' ' && target && isInteractiveControlTarget(target)) return

      let acted: boolean
      switch (e.key) {
        case ' ':
          acted = commands.toggleViewed()
          break
        case 'PageDown':
          acted = commands.nextFile()
          break
        case 'PageUp':
          acted = commands.prevFile()
          break
        default:
          return
      }
      if (acted) e.preventDefault()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commands])
}
