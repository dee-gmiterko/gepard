import { z } from 'zod';
import type { KeyBinding } from '../keyboard/bindings';

export const Modifier = z.enum(['Ctrl', 'Alt', 'Meta', 'Shift']);
export type Modifier = z.infer<typeof Modifier>;

export const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Meta', 'Shift']);

export interface KeyChordSource {
  key: string;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

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
  for (const m of Modifier.options) {
    if (key.length > m.length + 1 && key.startsWith(`${m}+`)) {
      modifiers.push(m);
      key = key.slice(m.length + 1);
    }
  }
  return { modifiers, key };
}

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

export type KeybindingOverrides = Record<string, string>;

export function effectiveKey(
  binding: KeyBinding,
  overrides: KeybindingOverrides | undefined,
): string {
  return overrides?.[binding.id] ?? binding.key;
}
