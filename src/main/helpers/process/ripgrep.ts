import { rgPath as rgPathRaw } from '@vscode/ripgrep';
import { matchesTarget } from '@gepard/common/model/paths';
import { run, ExecError } from './exec';

// Electron cannot execute binaries from inside an asar archive.
function resolveRgPath(): string {
  return rgPathRaw.includes('app.asar')
    ? rgPathRaw.replace('app.asar', 'app.asar.unpacked')
    : rgPathRaw;
}

export interface RipgrepMatch {
  line: number;
  preview: string;
  spans: Array<[number, number]>;
}

export interface RipgrepFileResult {
  path: string;
  matches: RipgrepMatch[];
}

export interface RipgrepSearchOptions {
  cwd: string;
  pattern: string;
  fixedString: boolean;
  word?: boolean;
  paths?: string[];
  signal?: AbortSignal;
}

interface RgMatchMessage {
  type: 'match';
  data: {
    path: { text?: string; bytes?: string };
    lines: { text?: string; bytes?: string };
    line_number: number;
    submatches: Array<{ start: number; end: number }>;
  };
}

function isMatchMessage(m: unknown): m is RgMatchMessage {
  return typeof m === 'object' && m !== null && (m as { type?: unknown }).type === 'match';
}

// ripgrep reports UTF-8 byte offsets, while JS strings index by UTF-16 code units.
export function utf16ByteBoundaries(text: string): number[] {
  const boundaries = new Array<number>(text.length + 1);
  boundaries[0] = 0;
  let i = 0;
  let bytes = 0;
  while (i < text.length) {
    const codePoint = text.codePointAt(i) as number;
    bytes += Buffer.byteLength(String.fromCodePoint(codePoint), 'utf8');
    if (codePoint > 0xffff) {
      // A code point above U+FFFF occupies two UTF-16 code units.
      boundaries[i + 1] = bytes;
      boundaries[i + 2] = bytes;
      i += 2;
    } else {
      boundaries[i + 1] = bytes;
      i += 1;
    }
  }
  return boundaries;
}

export function byteOffsetToUtf16(boundaries: number[], byteOffset: number): number {
  let lo = 0;
  let hi = boundaries.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (boundaries[mid] < byteOffset) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function parseMatches(stdout: string): Map<string, RipgrepMatch[]> {
  const files = new Map<string, RipgrepMatch[]>();
  for (const line of stdout.split('\n')) {
    if (!line) continue;
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isMatchMessage(msg)) continue;
    const filePath = msg.data.path.text;
    const rawLine = msg.data.lines.text;
    // ripgrep's --json output uses `bytes` instead of `text` for non-UTF-8 data.
    if (filePath === undefined || rawLine === undefined) continue;

    const boundaries = utf16ByteBoundaries(rawLine);
    const spans: Array<[number, number]> = msg.data.submatches.map((s) => [
      byteOffsetToUtf16(boundaries, s.start),
      byteOffsetToUtf16(boundaries, s.end),
    ]);
    const relPath = filePath.startsWith('./') ? filePath.slice(2) : filePath;
    const list = files.get(relPath) ?? [];
    list.push({ line: msg.data.line_number, preview: rawLine.trimEnd(), spans });
    files.set(relPath, list);
  }
  return files;
}

export async function ripgrepSearch(opts: RipgrepSearchOptions): Promise<RipgrepFileResult[]> {
  // Always search the whole tree and filter the results with matchesTarget
  // (the app's own path/glob semantics) below, rather than asking rg to
  // narrow the search itself: rg's own `--glob` is unanchored on a bare
  // basename pattern (unlike matchesTarget), a positional path argument and
  // an include `--glob` filter each other in ways that drop legitimate
  // matches when mixed, and argv would otherwise grow with every targeted
  // path, which can exceed the OS argv limit on a large PR.
  const targetedPaths = opts.paths;
  if (targetedPaths && targetedPaths.length === 0) return [];

  const args = ['--json', '--hidden', '--glob', '!.git'];
  if (opts.fixedString) args.push('-F');
  if (opts.word) args.push('-w');
  args.push('--', opts.pattern, '.');

  let stdout: string;
  try {
    // rg searches stdin instead of the paths when stdin is a non-TTY pipe,
    // so run() must not pipe anything to it (no `stdin` option is passed).
    ({ stdout } = await run(resolveRgPath(), args, { cwd: opts.cwd, signal: opts.signal }));
  } catch (e) {
    // rg exits with code 1 when nothing matched.
    if (e instanceof ExecError && e.exitCode === 1) return [];
    throw e;
  }

  const files = parseMatches(stdout);
  return Array.from(files.entries())
    .map(([filePath, matches]) => ({
      path: filePath,
      matches: matches.sort((a, b) => a.line - b.line),
    }))
    .filter((f) => !targetedPaths || targetedPaths.some((t) => matchesTarget(f.path, t)))
    .sort((a, b) => a.path.localeCompare(b.path));
}
