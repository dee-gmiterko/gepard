import { describe, expect, it } from 'vitest';
import { formatCaughtError } from '../../helpers/error';

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
