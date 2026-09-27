import { spawn } from 'node:child_process'
import { rgPath as rgPathRaw } from '@vscode/ripgrep'
import { matchesTarget } from '@shared/model/paths'

// Electron cannot execute binaries from inside an asar archive.
function resolveRgPath(): string {
  return rgPathRaw.includes('app.asar')
    ? rgPathRaw.replace('app.asar', 'app.asar.unpacked')
    : rgPathRaw
}

export interface RipgrepMatch {
  line: number
  preview: string
  spans: Array<[number, number]>
}

export interface RipgrepFileResult {
  path: string
  matches: RipgrepMatch[]
}

export interface RipgrepSearchOptions {
  cwd: string
  pattern: string
  fixedString: boolean
  word?: boolean
  paths?: string[]
  signal?: AbortSignal
}

interface RgMatchMessage {
  type: 'match'
  data: {
    path: { text?: string; bytes?: string }
    lines: { text?: string; bytes?: string }
    line_number: number
    submatches: Array<{ start: number; end: number }>
  }
}

function isMatchMessage(m: unknown): m is RgMatchMessage {
  return typeof m === 'object' && m !== null && (m as { type?: unknown }).type === 'match'
}

// ripgrep reports UTF-8 byte offsets, while JS strings index by UTF-16 code units.
export function utf16ByteBoundaries(text: string): number[] {
  const boundaries = new Array<number>(text.length + 1)
  boundaries[0] = 0
  let i = 0
  let bytes = 0
  while (i < text.length) {
    const codePoint = text.codePointAt(i) as number
    bytes += Buffer.byteLength(String.fromCodePoint(codePoint), 'utf8')
    if (codePoint > 0xffff) {
      // A code point above U+FFFF occupies two UTF-16 code units.
      boundaries[i + 1] = bytes
      boundaries[i + 2] = bytes
      i += 2
    } else {
      boundaries[i + 1] = bytes
      i += 1
    }
  }
  return boundaries
}

export function byteOffsetToUtf16(boundaries: number[], byteOffset: number): number {
  let lo = 0
  let hi = boundaries.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (boundaries[mid] < byteOffset) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function ripgrepSearch(opts: RipgrepSearchOptions): Promise<RipgrepFileResult[]> {
  // Always search the whole tree and filter the results with matchesTarget
  // (the app's own path/glob semantics) below, rather than asking rg to
  // narrow the search itself: rg's own `--glob` is unanchored on a bare
  // basename pattern (unlike matchesTarget), a positional path argument and
  // an include `--glob` filter each other in ways that drop legitimate
  // matches when mixed, and argv would otherwise grow with every targeted
  // path, which can exceed the OS argv limit on a large PR.
  const targetedPaths = opts.paths
  if (targetedPaths && targetedPaths.length === 0) return Promise.resolve([])

  const args = ['--json', '--hidden', '--glob', '!.git']
  if (opts.fixedString) args.push('-F')
  if (opts.word) args.push('-w')
  args.push('--', opts.pattern, '.')

  return new Promise((resolve, reject) => {
    // rg searches stdin instead of the paths when stdin is a non-TTY pipe.
    const child = spawn(resolveRgPath(), args, {
      cwd: opts.cwd,
      signal: opts.signal,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const files = new Map<string, RipgrepMatch[]>()
    let buf = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      buf += chunk
      let idx: number
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx)
        buf = buf.slice(idx + 1)
        if (!line) continue
        let msg: unknown
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }
        if (!isMatchMessage(msg)) continue
        const filePath = msg.data.path.text
        const rawLine = msg.data.lines.text
        // ripgrep's --json output uses `bytes` instead of `text` for non-UTF-8 data.
        if (filePath === undefined || rawLine === undefined) continue

        const boundaries = utf16ByteBoundaries(rawLine)
        const spans: Array<[number, number]> = msg.data.submatches.map((s) => [
          byteOffsetToUtf16(boundaries, s.start),
          byteOffsetToUtf16(boundaries, s.end)
        ])
        const relPath = filePath.startsWith('./') ? filePath.slice(2) : filePath
        const list = files.get(relPath) ?? []
        list.push({ line: msg.data.line_number, preview: rawLine.trimEnd(), spans })
        files.set(relPath, list)
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code !== null && code > 1) {
        reject(new Error(`rg exited with code ${code}: ${stderr.trim()}`))
        return
      }
      // rg exits with code 1 when nothing matched.
      const results = Array.from(files.entries())
        .map(([filePath, matches]) => ({
          path: filePath,
          matches: matches.sort((a, b) => a.line - b.line)
        }))
        .filter((f) => !targetedPaths || targetedPaths.some((t) => matchesTarget(f.path, t)))
        .sort((a, b) => a.path.localeCompare(b.path))
      resolve(results)
    })
  })
}
