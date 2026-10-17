import { describe, expect, it } from 'vitest';
import { formatLineReference } from '../../helpers/lineReference';

describe('formatLineReference', () => {
  it('joins path and line with a colon', () => {
    expect(formatLineReference({ path: 'src/a.ts', line: 12 })).toBe('src/a.ts:12');
  });
});
