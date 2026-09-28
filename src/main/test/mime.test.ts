import { describe, expect, it } from 'vitest';
import { mimeForPath } from '../helpers/fs/mime';

describe('mimeForPath', () => {
  it('maps known image extensions case-insensitively', () => {
    expect(mimeForPath('a/b/photo.PNG')).toBe('image/png');
    expect(mimeForPath('icon.svg')).toBe('image/svg+xml');
    expect(mimeForPath('pic.jpeg')).toBe('image/jpeg');
  });

  it('returns null for non-image or extension-less paths', () => {
    expect(mimeForPath('README.md')).toBeNull();
    expect(mimeForPath('Makefile')).toBeNull();
  });
});
