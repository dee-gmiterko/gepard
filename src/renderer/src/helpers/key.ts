import { z } from 'zod';
import { keyBindings, type KeyBinding } from '../keyboard/bindings';
import { gamepadLabel, isGamepadInput } from './gamepad';

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

export type KeybindingOverrides = Record<string, readonly string[]>;

export function effectiveKeys(
  binding: KeyBinding,
  overrides: KeybindingOverrides | undefined,
): readonly string[] {
  return overrides?.[binding.id] ?? binding.keys;
}

export function bindingMatches(
  binding: KeyBinding,
  input: string,
  overrides: KeybindingOverrides | undefined,
): boolean {
  return effectiveKeys(binding, overrides).includes(input);
}

export function inputLabel(input: string): string {
  return isGamepadInput(input) ? gamepadLabel(input) : keyLabel(input);
}

export function bindingKeyLabel(id: string, overrides: KeybindingOverrides | undefined): string {
  const binding = keyBindings.find((b) => b.id === id);
  if (!binding) return '';
  const keys = effectiveKeys(binding, overrides);
  const preferred = keys.find((k) => !isGamepadInput(k)) ?? keys[0];
  return preferred === undefined ? '' : inputLabel(preferred);
}

export function collidingInputs(
  bindings: readonly KeyBinding[],
  overrides: KeybindingOverrides | undefined,
): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const binding of bindings) {
    for (const input of effectiveKeys(binding, overrides)) {
      const ids = owners.get(input) ?? new Set<string>();
      ids.add(binding.id);
      owners.set(input, ids);
    }
  }
  return new Set([...owners].filter(([, ids]) => ids.size > 1).map(([input]) => input));
}
