// utf16ByteBoundaries/byteOffsetToUtf16 are pure and carry the actual risk
// (mapping ripgrep's byte offsets to CodeMirror's UTF-16 columns across
// multi-byte/astral characters) — tested directly with in-memory strings.
// ripgrepSearch itself is tested by really spawning ripgrep (report 03 §5's
// verdict is to spawn per query, so that spawn/argv/exit-code plumbing is the
// integration risk worth covering, kept to a handful of small cases).
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { byteOffsetToUtf16, ripgrepSearch, utf16ByteBoundaries } from '../src/main/services/ripgrep'
import { makeTmpDir, type TmpDir } from './support/tmp'

describe('utf16ByteBoundaries / byteOffsetToUtf16', () => {
  it('maps ASCII text 1:1 (bytes === UTF-16 units)', () => {
    const boundaries = utf16ByteBoundaries('hello')
    expect(boundaries).toEqual([0, 1, 2, 3, 4, 5])
    expect(byteOffsetToUtf16(boundaries, 3)).toBe(3)
  })

  it('maps an astral character (surrogate pair, 4 UTF-8 bytes) to 2 UTF-16 units', () => {
    // U+1F600 GRINNING FACE: 4 bytes in UTF-8, 2 code units in UTF-16.
    const text = '\u{1F600} smile'
    const boundaries = utf16ByteBoundaries(text)
    // byte 5 is where "smile" starts (4 emoji bytes + 1 space byte).
    expect(byteOffsetToUtf16(boundaries, 5)).toBe(3) // UTF-16 index 3 = 's' (surrogate pair + space)
    expect(byteOffsetToUtf16(boundaries, 10)).toBe(8) // end of "smile"
  })

  it('maps a BMP multi-byte character (e.g. "é", 2 UTF-8 bytes, 1 UTF-16 unit)', () => {
    const text = 'café bar' // "café bar"
    const boundaries = utf16ByteBoundaries(text)
    // "café" is 3 ASCII bytes + 2 bytes for é = 5 bytes; " bar" starts right after.
    expect(byteOffsetToUtf16(boundaries, 5)).toBe(4) // UTF-16 index 4 = the space after "café"
  })
})

describe('ripgrepSearch (real spawn)', () => {
  let dir: TmpDir

  beforeAll(async () => {
    dir = await makeTmpDir('ripgrep')
    await writeFile(join(dir.path, 'fixed.txt'), 'Hello World\nfoo bar\n')
    await writeFile(join(dir.path, 'word.txt'), 'cat category concatenate cat\n')
    await mkdir(join(dir.path, 'sub'))
    await writeFile(join(dir.path, 'sub', 'regex.txt'), 'foo\nfoa\nbaz\n')
  })

  afterAll(async () => {
    await dir.cleanup()
  })

  it('finds a fixed-string match', async () => {
    const results = await ripgrepSearch({ cwd: dir.path, pattern: 'World', fixedString: true })
    expect(results).toEqual([
      { path: 'fixed.txt', matches: [{ line: 1, preview: 'Hello World', spans: [[6, 11]] }] }
    ])
  })

  it('respects word boundaries (-w), grouping repeated matches on one line', () => {
    return ripgrepSearch({
      cwd: dir.path,
      pattern: 'cat',
      fixedString: true,
      word: true
    }).then((results) => {
      expect(results).toHaveLength(1)
      expect(results[0].path).toBe('word.txt')
      expect(results[0].matches).toEqual([
        {
          line: 1,
          preview: 'cat category concatenate cat',
          spans: [
            [0, 3],
            [25, 28]
          ]
        }
      ])
    })
  })

  it('supports a regex pattern', async () => {
    const results = await ripgrepSearch({
      cwd: dir.path,
      pattern: 'fo[ao]',
      fixedString: false,
      paths: ['sub']
    })
    expect(results).toEqual([
      {
        path: 'sub/regex.txt',
        matches: [
          { line: 1, preview: 'foo', spans: [[0, 3]] },
          { line: 2, preview: 'foa', spans: [[0, 3]] }
        ]
      }
    ])
  })

  it('rejects on an invalid regex', async () => {
    await expect(
      ripgrepSearch({ cwd: dir.path, pattern: '(unclosed', fixedString: false })
    ).rejects.toThrow()
  })

  it('resolves empty when every targeted path is missing from the working tree', async () => {
    const results = await ripgrepSearch({
      cwd: dir.path,
      pattern: 'anything',
      fixedString: true,
      paths: ['does-not-exist.txt']
    })
    expect(results).toEqual([])
  })
})
