import { describe, expect, it } from 'vitest';
import { urlAt } from '../../src/codeEditor/urlLinks';

describe('urlAt', () => {
  const line = 'see (https://example.com/a_(b)?q=1), or http://x.io.';

  it('finds the url under the offset and trims trailing punctuation', () => {
    expect(urlAt(line, 10)).toBe('https://example.com/a_(b)?q=1');
    expect(urlAt(line, line.indexOf('http://') + 3)).toBe('http://x.io');
  });

  it('returns null outside urls', () => {
    expect(urlAt(line, 1)).toBeNull();
    expect(urlAt('ftp://example.com', 3)).toBeNull();
  });
});
