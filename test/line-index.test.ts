import { describe, expect, it } from 'vitest'
import { LineIndex } from '../src/main/services/line-index'

describe('LineIndex.queryExactLine ("Also in")', () => {
  it('finds every other file with the same trimmed line, excluding the origin', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', '  const x = 1\nfoo()\n')
    idx.setFile('b.ts', 'const x = 1\n')
    idx.setFile('c.ts', 'unrelated\n')

    const results = idx.queryExactLine('const x = 1', { path: 'a.ts', line: 1 })

    expect(results).toEqual([
      { path: 'b.ts', matches: [{ line: 1, preview: 'const x = 1', spans: [[0, 11]] }] }
    ])
  })

  it('computes the span after leading whitespace on the indented occurrence', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', '    const x = 1\n')
    const results = idx.queryExactLine('const x = 1')
    expect(results).toEqual([
      { path: 'a.ts', matches: [{ line: 1, preview: '    const x = 1', spans: [[4, 15]] }] }
    ])
  })

  it('groups multiple matching lines within one file, sorted by line', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'x\nfoo()\nx\n')
    const results = idx.queryExactLine('x')
    expect(results).toEqual([
      {
        path: 'a.ts',
        matches: [
          { line: 1, preview: 'x', spans: [[0, 1]] },
          { line: 3, preview: 'x', spans: [[0, 1]] }
        ]
      }
    ])
  })

  it('sorts results by path', () => {
    const idx = new LineIndex()
    idx.setFile('z.ts', 'same\n')
    idx.setFile('a.ts', 'same\n')
    const results = idx.queryExactLine('same')
    expect(results.map((f) => f.path)).toEqual(['a.ts', 'z.ts'])
  })

  it('returns nothing for a line no file has', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'foo\n')
    expect(idx.queryExactLine('bar')).toEqual([])
  })

  it('strips trailing whitespace from the preview, matching ripgrep.ts', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'foo   \nfoo\n')
    const results = idx.queryExactLine('foo')
    expect(results[0].matches).toEqual([
      { line: 1, preview: 'foo', spans: [[0, 3]] },
      { line: 2, preview: 'foo', spans: [[0, 3]] }
    ])
  })
})

describe('LineIndex.queryWord ("Same pattern in")', () => {
  it('matches only whole-word occurrences, never a substring of a longer word', () => {
    const idx = new LineIndex()
    idx.setFile('word.ts', 'cat category concatenate cat\n')
    const results = idx.queryWord('cat')
    expect(results).toEqual([
      {
        path: 'word.ts',
        matches: [
          {
            line: 1,
            preview: 'cat category concatenate cat',
            spans: [
              [0, 3],
              [25, 28]
            ]
          }
        ]
      }
    ])
  })

  it('treats `$` as a boundary, same as ripgrep -w', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'const $scope = 1\n')
    const results = idx.queryWord('scope')
    expect(results).toEqual([
      { path: 'a.ts', matches: [{ line: 1, preview: 'const $scope = 1', spans: [[7, 12]] }] }
    ])
  })

  it('groups occurrences across files and lines, sorted', () => {
    const idx = new LineIndex()
    idx.setFile('b.ts', 'foo\n')
    idx.setFile('a.ts', 'bar\nfoo\n')
    const results = idx.queryWord('foo')
    expect(results).toEqual([
      { path: 'a.ts', matches: [{ line: 2, preview: 'foo', spans: [[0, 3]] }] },
      { path: 'b.ts', matches: [{ line: 1, preview: 'foo', spans: [[0, 3]] }] }
    ])
  })

  it('returns nothing for a word no file contains', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'foo\n')
    expect(idx.queryWord('bar')).toEqual([])
  })

  it('treats a non-ASCII letter as part of the word, same as ripgrep’s Unicode -w', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'café bar\n')
    expect(idx.queryWord('café')).toEqual([
      { path: 'a.ts', matches: [{ line: 1, preview: 'café bar', spans: [[0, 4]] }] }
    ])
    expect(idx.queryWord('caf')).toEqual([])
  })
})

describe('LineIndex incremental updates', () => {
  it('setFile again (re-index) replaces the old content, not adds to it', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'foo\n')
    idx.setFile('a.ts', 'bar\n')
    expect(idx.queryWord('foo')).toEqual([])
    expect(idx.queryWord('bar')).toEqual([
      { path: 'a.ts', matches: [{ line: 1, preview: 'bar', spans: [[0, 3]] }] }
    ])
  })

  it('removeFile drops both its exact-line and word entries, without leaking into a file that shares them', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'const x = 1\n')
    idx.setFile('b.ts', 'const x = 1\n')
    idx.removeFile('a.ts')
    expect(idx.queryExactLine('const x = 1')).toEqual([
      { path: 'b.ts', matches: [{ line: 1, preview: 'const x = 1', spans: [[0, 11]] }] }
    ])
    expect(idx.queryWord('x')).toEqual([
      { path: 'b.ts', matches: [{ line: 1, preview: 'const x = 1', spans: [[6, 7]] }] }
    ])
  })

  it('fileCount tracks the indexed set through add/update/remove', () => {
    const idx = new LineIndex()
    expect(idx.fileCount).toBe(0)
    idx.setFile('a.ts', 'x\n')
    expect(idx.fileCount).toBe(1)
    idx.setFile('a.ts', 'y\n')
    expect(idx.fileCount).toBe(1)
    idx.removeFile('a.ts')
    expect(idx.fileCount).toBe(0)
  })
})

describe('LineIndex line splitting', () => {
  it('drops a single trailing empty line from a final newline, like git diff parsing', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'one\ntwo\n')
    expect(idx.queryExactLine('')).toEqual([])
    expect(idx.queryExactLine('two')).toEqual([
      { path: 'a.ts', matches: [{ line: 2, preview: 'two', spans: [[0, 3]] }] }
    ])
  })

  it('handles a file with no trailing newline the same way', () => {
    const idx = new LineIndex()
    idx.setFile('a.ts', 'one\ntwo')
    expect(idx.queryExactLine('two')).toEqual([
      { path: 'a.ts', matches: [{ line: 2, preview: 'two', spans: [[0, 3]] }] }
    ])
  })
})
