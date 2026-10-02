import { describe, expect, it } from 'vitest';
import { errorMessage, isErrnoException } from '@gepard/common';

describe('errorMessage', () => {
  it('uses the message of an Error and stringifies anything else', () => {
    expect(errorMessage(new Error('bad'))).toBe('bad');
    expect(errorMessage('oops')).toBe('oops');
    expect(errorMessage(42)).toBe('42');
  });
});

describe('isErrnoException', () => {
  it('accepts errors carrying a code', () => {
    expect(isErrnoException(Object.assign(new Error('x'), { code: 'ENOENT' }))).toBe(true);
  });

  it('rejects plain errors and non-errors', () => {
    expect(isErrnoException(new Error('x'))).toBe(false);
    expect(isErrnoException({ code: 'ENOENT' })).toBe(false);
    expect(isErrnoException(null)).toBe(false);
  });
});
