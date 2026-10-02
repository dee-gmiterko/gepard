import { describe, expect, it } from 'vitest';
import type { KeyBinding } from '../src/keyboard/bindings';
import { effectiveKey, keyChord, keyLabel, splitChord } from '../src/helpers/key';

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

describe('effectiveKey', () => {
  const binding: KeyBinding = {
    id: 'go',
    key: 'g',
    label: { defaultMessage: 'Go' },
    run: () => true,
  };

  it('prefers an override and otherwise uses the default key', () => {
    expect(effectiveKey(binding, { go: 'h' })).toBe('h');
    expect(effectiveKey(binding, {})).toBe('g');
    expect(effectiveKey(binding, undefined)).toBe('g');
  });
});
