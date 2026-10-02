import { describe, expect, it } from 'vitest';
import { formatCaughtError } from '../helpers/error';
import { isLocaleData } from '../helpers/extension';
import { isFn } from '../helpers/type-guards';

describe('formatCaughtError', () => {
  it('uses the stack of an Error', () => {
    const e = new Error('boom');
    expect(formatCaughtError(e)).toBe(e.stack);
  });

  it('falls back to the message when there is no stack', () => {
    const e = new Error('boom');
    e.stack = undefined;
    expect(formatCaughtError(e)).toBe('boom');
  });

  it('stringifies non-errors', () => {
    expect(formatCaughtError('plain')).toBe('plain');
    expect(formatCaughtError(42)).toBe('42');
  });
});

describe('isLocaleData', () => {
  it('rejects values that are not locale data', () => {
    expect(isLocaleData(null)).toBe(false);
    expect(isLocaleData({})).toBe(false);
    expect(isLocaleData('en')).toBe(false);
  });
});

describe('isFn', () => {
  it('is true only for functions', () => {
    expect(isFn(() => 1)).toBe(true);
    expect(isFn({})).toBe(false);
    expect(isFn(undefined)).toBe(false);
  });
});
