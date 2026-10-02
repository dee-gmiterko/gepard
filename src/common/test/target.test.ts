import { describe, expect, it } from 'vitest';
import { globToRegExp } from '@gepard/common';

describe('globToRegExp', () => {
  it('matches wildcards within and across segments', () => {
    expect(globToRegExp('src/*.ts').test('src/a.ts')).toBe(true);
    expect(globToRegExp('src/*.ts').test('src/sub/a.ts')).toBe(false);
    expect(globToRegExp('src/**/*.ts').test('src/sub/a.ts')).toBe(true);
  });

  it('matches dotfiles', () => {
    expect(globToRegExp('*.env').test('.env')).toBe(true);
  });
});
