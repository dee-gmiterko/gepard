// Line/pattern search via @vscode/ripgrep (report 03 §5): spawn per query,
// `--json`, group matches per file, convert byte offsets to UTF-16 columns.
// No index is kept — every call re-spawns ripgrep (report 03 §5.2 verdict).
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { rgPath as rgPathRaw } from '@vscode/ripgrep'

/** Binaries cannot execute from inside an asar (report 03 §5.3/§8). */
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
  /** `-F`: fixed string, not a regex. */
  fixedString: boolean
  /** `-w`: whole word ("Same pattern in" from the comment editor). */
  word?: boolean
  /** Restricts the search to these files/folders (repo-relative); absent or
   * empty searches the whole repo. */
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

/** boundaries[i] = UTF-8 byte length of `text`'s first `i` UTF-16 code units;
 * used to map ripgrep's byte offsets back to UTF-16 (CodeMirror) columns. */
export function utf16ByteBoundaries(text: string): number[] {
  const boundaries = new Array<number>(text.length + 1)
  boundaries[0] = 0
  let i = 0
  let bytes = 0
  while (i < text.length) {
    const codePoint = text.codePointAt(i) as number
    bytes += Buffer.byteLength(String.fromCodePoint(codePoint), 'utf8')
    if (codePoint > 0xffff) {
      // astral character: occupies two UTF-16 code units (a surrogate pair)
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

/** Spawns ripgrep once for `opts` and resolves with matches grouped per file,
 * sorted by path (report 03 §5.2: `--sort path` forces single-thread, so we
 * sort in JS instead). */
export function ripgrepSearch(opts: RipgrepSearchOptions): Promise<RipgrepFileResult[]> {
  // Targeted paths can name files that do not exist in the working tree
  // (files deleted by the PR); rg exits 2 on a missing path argument, so
  // drop them. If nothing is left there is nothing to search.
  const paths = opts.paths?.filter((p) => existsSync(join(opts.cwd, p)))
  if (opts.paths && opts.paths.length > 0 && paths?.length === 0) return Promise.resolve([])

  const args = ['--json', '--glob', '!.git']
  if (opts.fixedString) args.push('-F')
  if (opts.word) args.push('-w')
  args.push('--', opts.pattern)
  args.push(...(paths && paths.length > 0 ? paths : ['.']))

  return new Promise((resolve, reject) => {
    // stdin MUST be ignored: rg searches stdin when it is a non-TTY pipe and hangs.
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
        if (filePath === undefined || rawLine === undefined) continue // non-UTF8 (binary) line; skip

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
      // code === 1 means "no matches", not an error.
      const results = Array.from(files.entries())
        .map(([filePath, matches]) => ({
          path: filePath,
          matches: matches.sort((a, b) => a.line - b.line)
        }))
        .sort((a, b) => a.path.localeCompare(b.path))
      resolve(results)
    })
  })
}
