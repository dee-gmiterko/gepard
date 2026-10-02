import { describe, expect, it } from 'vitest';
import { isAllowedExternalUrl } from '../helpers/url';

describe('isAllowedExternalUrl', () => {
  it('allows http and https only', () => {
    expect(isAllowedExternalUrl('https://example.com/a')).toBe(true);
    expect(isAllowedExternalUrl('http://example.com')).toBe(true);
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects text that is not a URL', () => {
    expect(isAllowedExternalUrl('not a url')).toBe(false);
  });
});
