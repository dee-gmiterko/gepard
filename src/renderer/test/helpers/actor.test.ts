import { describe, expect, it } from 'vitest';
import type { Viewer } from '@gepard/common';
import { authorDisplayName } from '../../src/helpers/actor';

const viewer = (name: string | null): Viewer => ({
  login: 'me',
  name,
  avatarUrl: 'https://example.com/a.png',
  htmlUrl: 'https://github.com/me',
});

describe('authorDisplayName', () => {
  it('prefers the author name, then login', () => {
    expect(authorDisplayName({ login: 'al', name: 'Alice' }, null)).toBe('Alice');
    expect(authorDisplayName({ login: 'al', name: null }, null)).toBe('al');
  });

  it('falls back to the viewer, then an empty string', () => {
    expect(authorDisplayName(null, viewer('Me'))).toBe('Me');
    expect(authorDisplayName(null, viewer(null))).toBe('me');
    expect(authorDisplayName(null, null)).toBe('');
  });
});
