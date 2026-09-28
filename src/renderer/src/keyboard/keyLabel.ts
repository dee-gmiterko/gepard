// Display labels for arbitrary `KeyboardEvent.key` values captured live
// during rebinding. `bindings.ts` ships a curated `keyLabel` for each
// default key, but a captured override can be any key, so this derives a
// reasonable label for the rest.
const NAMED_KEYS: Record<string, string> = {
  ' ': 'Space',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  PageUp: 'Page Up',
  PageDown: 'Page Down',
  Escape: 'Esc',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  Insert: 'Insert',
};

export function keyLabel(key: string): string {
  if (key in NAMED_KEYS) return NAMED_KEYS[key];
  if (/^F[0-9]{1,2}$/.test(key)) return key;
  if (key.length === 1) return key.toUpperCase();
  return key;
}
