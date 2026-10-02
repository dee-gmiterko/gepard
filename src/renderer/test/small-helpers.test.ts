import { describe, expect, it } from 'vitest';
import type { Viewer } from '@gepard/common';
import { authorDisplayName } from '../src/helpers/actor';
import { unionByKey } from '../src/helpers/array';
import { imageSrc } from '../src/helpers/image';
import { basename, foldersOf, isValidRepoPath } from '../src/helpers/paths';
import { escapeRegExp } from '../src/helpers/string';

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

describe('unionByKey', () => {
  it('keeps the first item per key in order', () => {
    const out = unionByKey(
      [{ k: 'a', v: 1 }],
      [
        { k: 'a', v: 2 },
        { k: 'b', v: 3 },
      ],
      (i) => i.k,
    );
    expect(out).toEqual([
      { k: 'a', v: 1 },
      { k: 'b', v: 3 },
    ]);
  });
});

describe('imageSrc', () => {
  it('builds a base64 data URL', () => {
    expect(imageSrc({ mime: 'image/png', base64: 'QUJD' })).toBe('data:image/png;base64,QUJD');
  });
});

describe('foldersOf', () => {
  it('lists every ancestor folder once, sorted', () => {
    expect(foldersOf(['src/a/x.ts', 'src/b.ts', 'README.md'])).toEqual(['src', 'src/a']);
  });

  it('returns nothing for root-level files', () => {
    expect(foldersOf(['a.ts'])).toEqual([]);
  });
});

describe('basename', () => {
  it('returns the last segment', () => {
    expect(basename('a/b/c.ts')).toBe('c.ts');
    expect(basename('c.ts')).toBe('c.ts');
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metacharacters so the text matches literally', () => {
    const text = 'a.b*c(d)[e]';
    expect(new RegExp(escapeRegExp(text)).test(text)).toBe(true);
    expect(new RegExp(escapeRegExp('a.b')).test('axb')).toBe(false);
  });
});

describe('isValidRepoPath', () => {
  it('accepts relative repository paths', () => {
    expect(isValidRepoPath('package.json')).toBe(true);
    expect(isValidRepoPath('src/main')).toBe(true);
  });

  it('rejects absolute, backslash and parent-traversal paths', () => {
    expect(isValidRepoPath('/package.json')).toBe(false);
    expect(isValidRepoPath('src\\main')).toBe(false);
    expect(isValidRepoPath('../x')).toBe(false);
    expect(isValidRepoPath('a/../x')).toBe(false);
  });
});
