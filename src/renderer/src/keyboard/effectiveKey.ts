import type { KeyBinding } from './bindings';

export type KeybindingOverrides = Record<string, string>;

export function effectiveKey(
  binding: KeyBinding,
  overrides: KeybindingOverrides | undefined,
): string {
  return overrides?.[binding.id] ?? binding.key;
}
