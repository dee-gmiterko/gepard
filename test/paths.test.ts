// Pure helpers shared by main (search scoping) and renderer (targeted lists).
import { describe, expect, it } from 'vitest'
import { isTargeted, isWithin } from '../src/shared/model/paths'

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
})
