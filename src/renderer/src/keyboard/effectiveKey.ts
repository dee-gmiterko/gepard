import type { KeyBinding } from './bindings';

export type KeybindingOverrides = Record<string, string>;

// The single place that resolves "what key actually triggers this binding":
// the persisted override if one is set, otherwise the binding's hardcoded
// default. Both `useGlobalKeys` (matching keydown events) and
// `KeybindingsPanel` (displaying/detecting conflicts) must agree on this, so
// they both go through this function rather than reading `binding.key`
// directly.
export function effectiveKey(
  binding: KeyBinding,
  overrides: KeybindingOverrides | undefined,
): string {
  return overrides?.[binding.id] ?? binding.key;
}
