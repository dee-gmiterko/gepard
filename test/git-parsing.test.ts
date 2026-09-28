import { describe, expect, it } from 'vitest'
import {
  parseBranchNames,
  parseCloneProgressLine,
  parseDiffTreeStdinFiles,
  parseNameStatus,
  parseNumstat,
  parseUnifiedDiff,
  selectDiffSection
} from '../src/main/helpers/gitParsing'
import { looksBinary } from '../src/main/helpers/binary'

describe('parseCloneProgressLine', () => {
  it('parses a local progress line into phase + percent', () => {
    expect(parseCloneProgressLine('Receiving objects:  42% (21/50)')).toEqual({
      phase: 'receiving',
      percent: 42
    })
  })

  it('parses the "remote: " prefixed form GitHub sends', () => {
    expect(parseCloneProgressLine('remote: Counting objects: 100% (10/10), done.')).toEqual({
      phase: 'counting',
      percent: 100
    })
  })

  it('recognises every phase label', () => {
    expect(parseCloneProgressLine('Compressing objects:   5% (1/20)')).toEqual({
      phase: 'compressing',
      percent: 5
    })
    expect(parseCloneProgressLine('Resolving deltas: 100% (3/3), done.')).toEqual({
      phase: 'resolving',
      percent: 100
    })
    expect(parseCloneProgressLine('Updating files:  50% (1/2)')).toEqual({
      phase: 'checkout',
      percent: 50
    })
  })

  it('returns null for unrelated stderr lines', () => {
    expect(parseCloneProgressLine("Cloning into 'repo'...")).toBeNull()
    expect(parseCloneProgressLine('')).toBeNull()
  })
})

describe('parseNameStatus', () => {
  it('parses a plain add/modify/delete entries', () => {
    const tokens = ['A', 'new.txt', 'M', 'existing.txt', 'D', 'gone.txt']
    expect(parseNameStatus(tokens)).toEqual([
      { status: 'A', path: 'new.txt', previousPath: null },
      { status: 'M', path: 'existing.txt', previousPath: null },
      { status: 'D', path: 'gone.txt', previousPath: null }
    ])
  })

  it('parses a rename entry (score-suffixed letter, old path, new path)', () => {
    const tokens = ['R100', 'old/name.txt', 'new/name.txt']
    expect(parseNameStatus(tokens)).toEqual([
      { status: 'R', path: 'new/name.txt', previousPath: 'old/name.txt' }
    ])
  })

  it('parses a copy entry the same way as a rename', () => {
    const tokens = ['C75', 'src.txt', 'copy.txt']
    expect(parseNameStatus(tokens)).toEqual([
      { status: 'C', path: 'copy.txt', previousPath: 'src.txt' }
    ])
  })

  it('handles a mix of renames and plain entries in one diff', () => {
    const tokens = ['M', 'a.txt', 'R090', 'b.txt', 'c.txt', 'A', 'd.txt']
    expect(parseNameStatus(tokens)).toEqual([
      { status: 'M', path: 'a.txt', previousPath: null },
      { status: 'R', path: 'c.txt', previousPath: 'b.txt' },
      { status: 'A', path: 'd.txt', previousPath: null }
    ])
  })
})

describe('parseNumstat', () => {
  it('parses plain numstat lines', () => {
    const tokens = ['3\t1\ta.txt', '0\t5\tb.txt']
    expect(parseNumstat(tokens)).toEqual([
      { additions: 3, deletions: 1, path: 'a.txt' },
      { additions: 0, deletions: 5, path: 'b.txt' }
    ])
  })

  it('parses a binary entry ("-" additions/deletions) as null counts', () => {
    const tokens = ['-\t-\timage.png']
    expect(parseNumstat(tokens)).toEqual([{ additions: null, deletions: null, path: 'image.png' }])
  })

  it("parses a rename's three-token numstat form (empty path, old, new)", () => {
    const tokens = ['0\t0\t', 'old/name.txt', 'new/name.txt']
    expect(parseNumstat(tokens)).toEqual([{ additions: 0, deletions: 0, path: 'new/name.txt' }])
  })

  it('throws on a malformed line', () => {
    expect(() => parseNumstat(['not a numstat line'])).toThrow()
  })
})

describe('parseUnifiedDiff', () => {
  it('turns a hunk into context/add/delete rows with old/new line numbers', () => {
    const diff = ['@@ -1,3 +1,4 @@', ' line1', '-line2', '+CHANGED', ' line3', '+line4', ''].join(
      '\n'
    )
    const rows = parseUnifiedDiff(diff)
    expect(rows[0]).toEqual({ kind: 'hunk', oldLine: null, newLine: null, text: '@@ -1,3 +1,4 @@' })
    expect(rows).toContainEqual({ kind: 'context', oldLine: 1, newLine: 1, text: 'line1' })
    expect(rows).toContainEqual({ kind: 'delete', oldLine: 2, newLine: null, text: 'line2' })
    expect(rows).toContainEqual({ kind: 'add', oldLine: null, newLine: 2, text: 'CHANGED' })
    expect(rows).toContainEqual({ kind: 'context', oldLine: 3, newLine: 3, text: 'line3' })
    expect(rows).toContainEqual({ kind: 'add', oldLine: null, newLine: 4, text: 'line4' })
  })

  it('ignores the "no newline at end of file" marker', () => {
    const diff = ['@@ -1,1 +1,1 @@', '-old', '\\ No newline at end of file', '+new', ''].join('\n')
    const rows = parseUnifiedDiff(diff)
    expect(rows).toEqual([
      { kind: 'hunk', oldLine: null, newLine: null, text: '@@ -1,1 +1,1 @@' },
      { kind: 'delete', oldLine: 1, newLine: null, text: 'old' },
      { kind: 'add', oldLine: null, newLine: 1, text: 'new' }
    ])
  })

  it('returns no rows for an empty diff (e.g. a pure rename with no content change)', () => {
    expect(parseUnifiedDiff('')).toEqual([])
  })

  it('supports multiple hunks, each resetting the running line counters', () => {
    const diff = ['@@ -1,1 +1,1 @@', '-a', '+A', '@@ -10,1 +10,1 @@', '-z', '+Z', ''].join('\n')
    const rows = parseUnifiedDiff(diff)
    expect(rows.filter((r) => r.kind === 'hunk')).toHaveLength(2)
    expect(rows).toContainEqual({ kind: 'delete', oldLine: 10, newLine: null, text: 'z' })
    expect(rows).toContainEqual({ kind: 'add', oldLine: null, newLine: 10, text: 'Z' })
  })
})

describe('parseDiffTreeStdinFiles', () => {
  const A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'

  it('groups each oid with the files its diff-tree output lists below it', () => {
    const stdout = `${A}\0\nsrc/a.ts\0src/b.ts\0${B}\0\ndocs/readme.md\0`
    expect(parseDiffTreeStdinFiles(stdout, [A, B])).toEqual(
      new Map([
        [A, ['src/a.ts', 'src/b.ts']],
        [B, ['docs/readme.md']]
      ])
    )
  })

  it('maps a given oid to no files when it touched nothing (e.g. an empty merge)', () => {
    const stdout = `${A}\0${B}\0\ndocs/readme.md\0`
    expect(parseDiffTreeStdinFiles(stdout, [A, B])).toEqual(
      new Map([
        [A, []],
        [B, ['docs/readme.md']]
      ])
    )
  })

  it('omits a root commit entirely (diff-tree never emits one)', () => {
    expect(parseDiffTreeStdinFiles(`${B}\0\nsrc/a.ts\0`, [A, B])).toEqual(
      new Map([[B, ['src/a.ts']]])
    )
  })

  it('returns an empty map for empty stdout', () => {
    expect(parseDiffTreeStdinFiles('', [A, B])).toEqual(new Map())
  })
})

describe('parseBranchNames', () => {
  it('strips the origin/ prefix from remote-tracking branches', () => {
    const stdout = ['main', 'origin/main', 'origin/feature-x'].join('\n')
    expect(parseBranchNames(stdout)).toEqual(['feature-x', 'main'])
  })

  it('drops the symbolic origin/HEAD entry', () => {
    const stdout = ['origin/HEAD', 'origin/main'].join('\n')
    expect(parseBranchNames(stdout)).toEqual(['main'])
  })

  it('sorts the result and ignores blank lines', () => {
    const stdout = ['origin/zeta', '', 'alpha', ''].join('\n')
    expect(parseBranchNames(stdout)).toEqual(['alpha', 'zeta'])
  })

  it('returns an empty list for empty stdout', () => {
    expect(parseBranchNames('')).toEqual([])
  })
})

describe('selectDiffSection', () => {
  it("isolates a copy target's section when its source also has its own diff", () => {
    const diffText = [
      'diff --git a/old.txt b/old.txt',
      'index 111..222 100644',
      '--- a/old.txt',
      '+++ b/old.txt',
      '@@ -1,1 +1,1 @@',
      '-original old content',
      '+changed old content',
      'diff --git a/old.txt b/new.txt',
      'similarity index 90%',
      'copy from old.txt',
      'copy to new.txt',
      'index 111..333 100644',
      '--- a/old.txt',
      '+++ b/new.txt',
      '@@ -1,1 +1,1 @@',
      '-original old content',
      '+copied new content',
      ''
    ].join('\n')

    const section = selectDiffSection(diffText, 'old.txt', 'new.txt')
    const rows = parseUnifiedDiff(section)
    expect(rows).toEqual([
      { kind: 'hunk', oldLine: null, newLine: null, text: '@@ -1,1 +1,1 @@' },
      { kind: 'delete', oldLine: 1, newLine: null, text: 'original old content' },
      { kind: 'add', oldLine: null, newLine: 1, text: 'copied new content' }
    ])
  })

  it('returns the whole text unchanged when the marker is not found', () => {
    const diffText = '@@ -1,1 +1,1 @@\n-a\n+b\n'
    expect(selectDiffSection(diffText, 'old.txt', 'new.txt')).toBe(diffText)
  })
})

describe('looksBinary', () => {
  it('treats a NUL byte in the first 8000 bytes as binary', () => {
    expect(looksBinary(Buffer.from([104, 101, 0, 108, 108, 111]))).toBe(true)
  })

  it('treats plain text as non-binary', () => {
    expect(looksBinary(Buffer.from('hello world\n', 'utf8'))).toBe(false)
  })
})
