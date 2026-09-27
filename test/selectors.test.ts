import { describe, expect, it } from 'vitest'
import { activeTargetRef, foldersOf, folderSourcePaths } from '../src/renderer/src/state/selectors'
import type { Targeting } from '../src/renderer/src/state/reducer'

function targeting(overrides: Partial<Targeting> = {}): Targeting {
  return { pr: null, commit: null, path: null, ...overrides }
}

describe('folderSourcePaths', () => {
  it('uses the full tree when neither a PR nor a commit is targeted', () => {
    const tree = ['a.ts', 'src/b.ts']
    expect(folderSourcePaths(targeting(), undefined, tree)).toBe(tree)
  })

  it('uses the changed files when a PR is targeted', () => {
    const changed = ['internal/flags.go']
    const tree = ['a.ts', 'src/b.ts']
    expect(folderSourcePaths(targeting({ pr: 7 }), changed, tree)).toBe(changed)
  })

  it('uses the changed files when a commit is targeted, even without a PR', () => {
    const changed = ['internal/flags.go']
    expect(folderSourcePaths(targeting({ commit: 'deadbeef' }), changed, ['a.ts'])).toBe(changed)
  })

  it('falls back to an empty list when scoped but the diff has not loaded yet', () => {
    expect(folderSourcePaths(targeting({ pr: 7 }), undefined, ['a.ts'])).toEqual([])
  })

  it('agrees with activeTargetRef on when a target is active', () => {
    const t = targeting({ commit: 'c' })
    expect(activeTargetRef(t)).not.toBeNull()
    expect(folderSourcePaths(t, ['x'], ['y'])).toEqual(['x'])
  })
})

describe('foldersOf', () => {
  it('derives every ancestor directory from a list of file paths', () => {
    expect(foldersOf(['src/a.ts', 'src/sub/b.ts', 'README.md'])).toEqual(['src', 'src/sub'])
  })

  it('deduplicates shared ancestors across files', () => {
    expect(foldersOf(['src/a.ts', 'src/b.ts'])).toEqual(['src'])
  })

  it('returns an empty list for root-level files only', () => {
    expect(foldersOf(['a.ts', 'b.ts'])).toEqual([])
  })

  it('returns an empty list for no paths', () => {
    expect(foldersOf([])).toEqual([])
  })
})
