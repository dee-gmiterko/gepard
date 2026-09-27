import { describe, expect, it } from 'vitest'
import {
  isGlob,
  isTargeted,
  isWithin,
  matchesTarget,
  staticPrefixOf
} from '../src/shared/model/paths'

describe('isWithin', () => {
  it('is true for the target path itself', () => {
    expect(isWithin('src/a.ts', 'src/a.ts')).toBe(true)
  })

  it('is true for a path nested under a targeted folder', () => {
    expect(isWithin('src/sub/b.ts', 'src')).toBe(true)
    expect(isWithin('src/sub/b.ts', 'src/')).toBe(true)
  })

  it('is false for a sibling path that merely shares a string prefix', () => {
    expect(isWithin('src-extra/b.ts', 'src')).toBe(false)
  })

  it('is false for an unrelated path', () => {
    expect(isWithin('other/b.ts', 'src')).toBe(false)
  })
})

describe('isTargeted', () => {
  it('is true when the path matches or is nested under any targeted entry', () => {
    expect(isTargeted('src/a.ts', ['src', 'docs/readme.md'])).toBe(true)
    expect(isTargeted('docs/readme.md', ['src', 'docs/readme.md'])).toBe(true)
  })

  it('is false when no targeted entry matches', () => {
    expect(isTargeted('other/a.ts', ['src', 'docs/readme.md'])).toBe(false)
  })

  it('is false for an empty targeting list', () => {
    expect(isTargeted('src/a.ts', [])).toBe(false)
  })

  it('matches a glob entry alongside a plain folder-prefix entry', () => {
    expect(isTargeted('src/a.spec.ts', ['docs', '*.spec.ts'])).toBe(false)
    expect(isTargeted('src/a.spec.ts', ['docs', 'src/*.spec.ts'])).toBe(true)
  })
})

describe('isGlob', () => {
  it('is false for a plain folder prefix or file path', () => {
    expect(isGlob('src')).toBe(false)
    expect(isGlob('src/a.ts')).toBe(false)
  })

  it('is true once the target carries a wildcard metacharacter', () => {
    expect(isGlob('src/*.ts')).toBe(true)
    expect(isGlob('src/?.ts')).toBe(true)
    expect(isGlob('src/[ab].ts')).toBe(true)
  })
})

describe('matchesTarget (the shared matcher)', () => {
  it('matches `*` against any run of characters within one path segment', () => {
    expect(matchesTarget('src/a.ts', 'src/*.ts')).toBe(true)
    expect(matchesTarget('src/sub/a.ts', 'src/*.ts')).toBe(false)
  })

  it('matches `**` across path separators, including zero components (a/**/b matches a/b)', () => {
    expect(matchesTarget('a/b', 'a/**/b')).toBe(true)
    expect(matchesTarget('src/a.ts', 'src/**/*.ts')).toBe(true)
    expect(matchesTarget('src/sub/a.ts', 'src/**/*.ts')).toBe(true)
    expect(matchesTarget('src/sub/deep/a.ts', 'src/**/*.ts')).toBe(true)
    expect(matchesTarget('other/a.ts', 'src/**/*.ts')).toBe(false)
  })

  it('requires a `**` in the middle to still span whole path components', () => {
    expect(matchesTarget('ab', 'a/**/b')).toBe(false)
    expect(matchesTarget('afoo/b', 'a/**/b')).toBe(false)
    expect(matchesTarget('src.ts', 'src/**/*.ts')).toBe(false)
    expect(matchesTarget('srcx/y.ts', 'src/**/*.ts')).toBe(false)
  })

  it('matches a leading or trailing `**` segment', () => {
    expect(matchesTarget('a.ts', '**/a.ts')).toBe(true)
    expect(matchesTarget('src/sub/a.ts', '**/a.ts')).toBe(true)
    expect(matchesTarget('src', 'src/**')).toBe(true)
    expect(matchesTarget('src/sub/a.ts', 'src/**')).toBe(true)
    expect(matchesTarget('other/a.ts', 'src/**')).toBe(false)
  })

  it('matches `?` against exactly one non-slash character', () => {
    expect(matchesTarget('src/a.ts', 'src/?.ts')).toBe(true)
    expect(matchesTarget('src/ab.ts', 'src/?.ts')).toBe(false)
  })

  it('matches a `[...]` character class', () => {
    expect(matchesTarget('src/a.ts', 'src/[ab].ts')).toBe(true)
    expect(matchesTarget('src/c.ts', 'src/[ab].ts')).toBe(false)
  })

  it('negates a `[!...]` or `[^...]` character class (shell and regex spellings alike)', () => {
    expect(matchesTarget('src/c.ts', 'src/[!ab].ts')).toBe(true)
    expect(matchesTarget('src/a.ts', 'src/[!ab].ts')).toBe(false)
    expect(matchesTarget('src/c.ts', 'src/[^ab].ts')).toBe(true)
    expect(matchesTarget('src/a.ts', 'src/[^ab].ts')).toBe(false)
  })
})

describe('staticPrefixOf', () => {
  it('is the target itself when there is no wildcard', () => {
    expect(staticPrefixOf('src/sub')).toBe('src/sub')
  })

  it('is the ancestor directory before the first wildcard', () => {
    expect(staticPrefixOf('src/*.ts')).toBe('src')
    expect(staticPrefixOf('src/sub/**/*.ts')).toBe('src/sub')
  })

  it('is empty when the wildcard is in the first path segment', () => {
    expect(staticPrefixOf('*.ts')).toBe('')
    expect(staticPrefixOf('a*b/c.ts')).toBe('')
  })
})
