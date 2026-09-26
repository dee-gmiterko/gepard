// Small debounce for typed searches (header comboboxes, side-panel search):
// typing shouldn't fire an IPC search on every keystroke.
import { useEffect, useState } from 'react'

export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}
