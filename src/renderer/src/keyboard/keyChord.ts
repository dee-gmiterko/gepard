const MODIFIERS = ['Ctrl', 'Alt', 'Meta', 'Shift'] as const;
export type Modifier = (typeof MODIFIERS)[number];

export const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Meta', 'Shift']);

export const MOD: Modifier =
  typeof navigator !== 'undefined' && /Mac/.test(navigator.platform) ? 'Meta' : 'Ctrl';

export interface KeyChordSource {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

// A plain key is `KeyboardEvent.key` verbatim (so stored single-key overrides
// keep matching); with modifiers a letter is upper-cased because Shift already
// changes its case and Cmd on macOS may not.
export function keyChord(e: KeyChordSource): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.metaKey) parts.push('Meta');
  if (e.shiftKey) parts.push('Shift');
  parts.push(parts.length > 0 && e.key.length === 1 ? e.key.toUpperCase() : e.key);
  return parts.join('+');
}

export function splitChord(chord: string): { modifiers: Modifier[]; key: string } {
  const modifiers: Modifier[] = [];
  let key = chord;
  for (const m of MODIFIERS) {
    if (key.length > m.length + 1 && key.startsWith(`${m}+`)) {
      modifiers.push(m);
      key = key.slice(m.length + 1);
    }
  }
  return { modifiers, key };
}
