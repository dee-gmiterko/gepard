import { describe, expect, it } from 'vitest';
import type { KeyBinding } from '../../src/keyboard/bindings';
import {
  bindingMatches,
  collidingInputs,
  effectiveKeys,
  bindingKeyLabel,
  inputLabel,
  isCustomized,
  keyChord,
  keyLabel,
  splitChord,
} from '../../src/helpers/key';

const event = (
  key: string,
  mods: Partial<Record<string, boolean>> = {},
): Parameters<typeof keyChord>[0] => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  shiftKey: false,
  ...mods,
});

describe('keyChord', () => {
  it('orders modifiers and upper-cases single keys with modifiers', () => {
    expect(keyChord(event('k', { ctrlKey: true, shiftKey: true }))).toBe('Ctrl+Shift+K');
    expect(keyChord(event('a', { altKey: true, metaKey: true }))).toBe('Alt+Meta+A');
  });

  it('keeps the key as is without modifiers', () => {
    expect(keyChord(event('j'))).toBe('j');
    expect(keyChord(event('ArrowDown', { ctrlKey: true }))).toBe('Ctrl+ArrowDown');
  });
});

describe('splitChord', () => {
  it('separates modifiers from the key', () => {
    expect(splitChord('Ctrl+Shift+K')).toEqual({ modifiers: ['Ctrl', 'Shift'], key: 'K' });
  });

  it('treats a plus key as the key itself', () => {
    expect(splitChord('Ctrl++')).toEqual({ modifiers: ['Ctrl'], key: '+' });
    expect(splitChord('x')).toEqual({ modifiers: [], key: 'x' });
  });
});

describe('keyLabel', () => {
  it('formats modifiers and named keys', () => {
    expect(keyLabel('Meta+ArrowUp')).toBe('Cmd+↑');
    expect(keyLabel('Ctrl+k')).toBe('Ctrl+K');
    expect(keyLabel('Escape')).toBe('Esc');
    expect(keyLabel('F5')).toBe('F5');
  });
});

const action = (id: string, keys: readonly string[]): KeyBinding => ({
  id,
  keys,
  label: { defaultMessage: id },
  run: () => true,
});

describe('effectiveKeys', () => {
  const binding = action('go', ['g', 'F3']);

  it('prefers an override list and otherwise uses the default keys', () => {
    expect(effectiveKeys(binding, { go: ['h', 'Gamepad:0'] })).toEqual(['h', 'Gamepad:0']);
    expect(effectiveKeys(binding, { go: [] })).toEqual([]);
    expect(effectiveKeys(binding, {})).toEqual(['g', 'F3']);
    expect(effectiveKeys(binding, undefined)).toEqual(['g', 'F3']);
  });
});

describe('bindingMatches', () => {
  const binding = action('go', ['g', 'F3']);

  it('matches any bound input of keyboard and gamepad kinds', () => {
    expect(bindingMatches(binding, 'F3', undefined)).toBe(true);
    expect(bindingMatches(binding, 'h', { go: ['h', 'Gamepad:2'] })).toBe(true);
    expect(bindingMatches(binding, 'Gamepad:2', { go: ['h', 'Gamepad:2'] })).toBe(true);
    expect(bindingMatches(binding, 'g', { go: ['h'] })).toBe(false);
  });
});

describe('inputLabel', () => {
  it('labels keyboard chords and gamepad buttons', () => {
    expect(inputLabel('Ctrl+k')).toBe('Ctrl+K');
    expect(inputLabel('Gamepad:0')).toBe('Gamepad A');
  });
});

describe('collidingInputs', () => {
  it('reports inputs bound to more than one action', () => {
    const bindings = [action('a', ['x', 'Gamepad:0']), action('b', ['y']), action('c', ['y'])];
    expect(collidingInputs(bindings, undefined)).toEqual(new Set(['y']));
    expect(collidingInputs(bindings, { b: ['Gamepad:0'] })).toEqual(new Set(['Gamepad:0']));
  });

  it('ignores repeats within one action', () => {
    expect(collidingInputs([action('a', ['x', 'x'])], undefined).size).toBe(0);
  });
});

describe('empty default keys', () => {
  const unbound = action('sync', []);

  it('has no keys or matches until bound', () => {
    expect(effectiveKeys(unbound, undefined)).toEqual([]);
    expect(bindingMatches(unbound, 'x', undefined)).toBe(false);
    expect(bindingMatches(unbound, 'x', { sync: ['x'] })).toBe(true);
  });

  it('does not collide', () => {
    expect(collidingInputs([unbound, action('b', [])], undefined).size).toBe(0);
  });

  it('has an empty label when unbound', () => {
    expect(bindingKeyLabel('sync', undefined)).toBe('');
    expect(bindingKeyLabel('sync', { sync: ['Gamepad:0'] })).toBe('Gamepad A');
  });
});

describe('isCustomized', () => {
  it('is true only when the override differs from the default keys', () => {
    const binding = action('go', ['g', 'F3']);
    expect(isCustomized(binding, undefined)).toBe(false);
    expect(isCustomized(binding, { go: ['g', 'F3'] })).toBe(false);
    expect(isCustomized(binding, { go: ['F3', 'g'] })).toBe(true);
    expect(isCustomized(binding, { go: [] })).toBe(true);
    expect(isCustomized(action('sync', []), { sync: [] })).toBe(false);
    expect(isCustomized(action('sync', []), { sync: ['x'] })).toBe(true);
  });
});
