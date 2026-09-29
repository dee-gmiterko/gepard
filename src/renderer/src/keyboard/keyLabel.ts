import { splitChord, type Modifier } from './keyChord';

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

const MODIFIER_LABELS: Record<Modifier, string> = {
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Meta: 'Cmd',
  Shift: 'Shift',
};

function plainKeyLabel(key: string): string {
  if (key in NAMED_KEYS) return NAMED_KEYS[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

export function keyLabel(chord: string): string {
  const { modifiers, key } = splitChord(chord);
  return [...modifiers.map((m) => MODIFIER_LABELS[m]), plainKeyLabel(key)].join('+');
}
