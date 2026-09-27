// Tokenizing into runs of `[A-Za-z0-9_]` (the class `\b` uses) matches
// `rg -w -F`'s whole-word semantics, since `rg -w` treats `$` as a boundary
// too — unlike `identifierAt()` in ipc/handlers/search.ts, which includes
// `$` when reading a symbol name.

const WORD_RE = /[A-Za-z0-9_]+/g

export interface LineIndexMatch {
  line: number
  preview: string
  spans: Array<[number, number]>
}

export interface LineIndexFileMatches {
  path: string
  matches: LineIndexMatch[]
}

interface LineHit {
  path: string
  line: number
}

interface WordHit {
  path: string
  line: number
  start: number
  end: number
}

interface FileEntry {
  lines: string[]
  lineKeys: Set<string>
  wordKeys: Set<string>
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

function removeFromBucket<T extends { path: string }>(
  map: Map<string, T[]>,
  key: string,
  path: string
): void {
  const list = map.get(key)
  if (!list) return
  const filtered = list.filter((e) => e.path !== path)
  if (filtered.length === 0) map.delete(key)
  else map.set(key, filtered)
}

// Matches what ripgrep's own submatch span would be for `rg -F -- <trimmed>`
// against `raw`.
function trimmedSpan(raw: string, trimmed: string): [number, number] {
  if (trimmed.length === 0) return [0, 0]
  const start = raw.length - raw.trimStart().length
  return [start, start + trimmed.length]
}

export class LineIndex {
  private files = new Map<string, FileEntry>()
  private byLine = new Map<string, LineHit[]>()
  private byWord = new Map<string, WordHit[]>()

  get fileCount(): number {
    return this.files.size
  }

  has(path: string): boolean {
    return this.files.has(path)
  }

  setFile(path: string, text: string): void {
    this.removeFile(path)
    const rawLines = text.split('\n')
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop()
    const lines = rawLines.map((l) => l.trimEnd())
    const lineKeys = new Set<string>()
    const wordKeys = new Set<string>()

    lines.forEach((raw, i) => {
      const lineNo = i + 1
      const trimmed = raw.trim()
      lineKeys.add(trimmed)
      push(this.byLine, trimmed, { path, line: lineNo })

      WORD_RE.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = WORD_RE.exec(raw))) {
        wordKeys.add(m[0])
        push(this.byWord, m[0], { path, line: lineNo, start: m.index, end: m.index + m[0].length })
      }
    })

    this.files.set(path, { lines, lineKeys, wordKeys })
  }

  removeFile(path: string): void {
    const entry = this.files.get(path)
    if (!entry) return
    this.files.delete(path)
    for (const key of entry.lineKeys) removeFromBucket(this.byLine, key, path)
    for (const key of entry.wordKeys) removeFromBucket(this.byWord, key, path)
  }

  queryExactLine(
    trimmed: string,
    exclude?: { path: string; line: number }
  ): LineIndexFileMatches[] {
    const hits = this.byLine.get(trimmed)
    if (!hits || hits.length === 0) return []

    const byPath = new Map<string, number[]>()
    for (const h of hits) {
      if (exclude && h.path === exclude.path && h.line === exclude.line) continue
      const lines = byPath.get(h.path)
      if (lines) lines.push(h.line)
      else byPath.set(h.path, [h.line])
    }

    const results: LineIndexFileMatches[] = []
    for (const [path, lineNos] of byPath) {
      const file = this.files.get(path)
      if (!file) continue
      const matches = lineNos
        .slice()
        .sort((a, b) => a - b)
        .map((line) => {
          const raw = file.lines[line - 1] ?? ''
          return { line, preview: raw, spans: [trimmedSpan(raw, trimmed)] }
        })
      results.push({ path, matches })
    }
    return results.sort((a, b) => a.path.localeCompare(b.path))
  }

  queryWord(word: string): LineIndexFileMatches[] {
    const hits = this.byWord.get(word)
    if (!hits || hits.length === 0) return []

    const byPath = new Map<string, Map<number, Array<[number, number]>>>()
    for (const h of hits) {
      let byLineMap = byPath.get(h.path)
      if (!byLineMap) {
        byLineMap = new Map()
        byPath.set(h.path, byLineMap)
      }
      const spans = byLineMap.get(h.line)
      if (spans) spans.push([h.start, h.end])
      else byLineMap.set(h.line, [[h.start, h.end]])
    }

    const results: LineIndexFileMatches[] = []
    for (const [path, byLineMap] of byPath) {
      const file = this.files.get(path)
      if (!file) continue
      const matches = Array.from(byLineMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([line, spans]) => ({
          line,
          preview: file.lines[line - 1] ?? '',
          spans: spans.slice().sort((a, b) => a[0] - b[0])
        }))
      results.push({ path, matches })
    }
    return results.sort((a, b) => a.path.localeCompare(b.path))
  }
}
