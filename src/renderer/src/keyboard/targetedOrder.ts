// The seam between the targeted file list (features/sidePanel/targeted) and
// the Up/Down commands. "Navigate files in targeted list" means the order the
// list shows (tree or flat), which only the list knows, so it publishes its
// visible file order here. Read at key-press time; nothing re-renders on it.
import { useEffect } from 'react'

let order: readonly string[] = []

export function getTargetedOrder(): readonly string[] {
  return order
}

/** Called by the targeted list with its files in display order. */
export function useRegisterTargetedOrder(paths: readonly string[]): void {
  useEffect(() => {
    order = paths
    return () => {
      if (order === paths) order = []
    }
  }, [paths])
}
