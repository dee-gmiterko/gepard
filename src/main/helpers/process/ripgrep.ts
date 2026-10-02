import { z } from 'zod';
import { rgPath as rgPathRaw } from '@vscode/ripgrep';
import { makeTargetMatcher } from '@gepard/common';
import { runLines, ExecError } from './exec';
import { clipPreview } from '../search/preview';
import { byteOffsetToUtf16, utf16ByteBoundaries } from '../string';

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
  moreMatches?: true;
}

export interface RipgrepSearchOptions {
  cwd: string;
  pattern: string;
  fixedString: boolean;
  word?: boolean;
  caseSensitive?: boolean;
  paths?: string[];
  signal?: AbortSignal;
  offset?: number;
  limit?: number;
  maxMatchesPerFile?: number;
  maxTotalMatches?: number;
}

export interface RipgrepPage {
  files: RipgrepFileResult[];
  hasMore: boolean;
  truncated: boolean;
}

const rgMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('begin'),
    data: z.object({ path: z.object({ text: z.string().optional() }) }),
  }),
  z.object({
    type: z.literal('match'),
    data: z.object({
      path: z.object({ text: z.string().optional(), bytes: z.string().optional() }),
      lines: z.object({ text: z.string().optional(), bytes: z.string().optional() }),
      line_number: z.number(),
      submatches: z.array(z.object({ start: z.number(), end: z.number() })),
    }),
  }),
  z.object({ type: z.literal('end') }),
]);
type RgMessage = z.infer<typeof rgMessageSchema>;
type RgMatchMessage = Extract<RgMessage, { type: 'match' }>;

function parseMessage(line: string): RgMessage | null {
  if (!line || line.startsWith('{"type":"summary"')) return null;
  let json: unknown;
  try {
    json = JSON.parse(line);
  } catch {
    return null;
  }
  const parsed = rgMessageSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function toMatch(msg: RgMatchMessage): RipgrepMatch | null {
  const rawLine = msg.data.lines.text;
  if (rawLine === undefined) return null;

  const ascii = Buffer.byteLength(rawLine, 'utf8') === rawLine.length;
  const boundaries = ascii ? null : utf16ByteBoundaries(rawLine);
  const spans = msg.data.submatches.map((s): [number, number] =>
    boundaries
      ? [byteOffsetToUtf16(boundaries, s.start), byteOffsetToUtf16(boundaries, s.end)]
      : [s.start, s.end],
  );
  return { line: msg.data.line_number, ...clipPreview(rawLine.trimEnd(), spans) };
}

export async function ripgrepSearchPage(opts: RipgrepSearchOptions): Promise<RipgrepPage> {
  const targets = opts.paths;
  if (targets && targets.length === 0) return { files: [], hasMore: false, truncated: false };
  const isTargeted = targets ? makeTargetMatcher(targets) : null;

  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? Infinity;
  const perFile = opts.maxMatchesPerFile;
  const totalCap = opts.maxTotalMatches ?? Infinity;

  const args = ['--json', '--hidden', '--no-ignore', '--sort', 'path', '--glob', '!.git'];
  if (opts.fixedString) args.push('-F');
  if (opts.word) args.push('-w');
  args.push(opts.caseSensitive ? '-s' : '-i');
  if (perFile !== undefined) args.push('--max-count', String(perFile + 1));
  args.push('--', opts.pattern, '.');

  const files: RipgrepFileResult[] = [];
  let current: { path: string; matches: RipgrepMatch[]; more: boolean } | null = null;
  let ignoring = false;
  let skipped = 0;
  let total = 0;
  let hasMore = false;
  let truncated = false;

  function finishFile(): void {
    if (current && current.matches.length > 0) {
      files.push(
        current.more
          ? { path: current.path, matches: current.matches, moreMatches: true }
          : { path: current.path, matches: current.matches },
      );
    }
    current = null;
  }

  function onLine(line: string): 'stop' | void {
    const msg = parseMessage(line);
    if (!msg) return;

    if (msg.type === 'begin') {
      finishFile();
      const raw = msg.data.path.text;
      const path = raw === undefined ? undefined : raw.startsWith('./') ? raw.slice(2) : raw;
      ignoring = path === undefined || (isTargeted !== null && !isTargeted(path));
      if (ignoring || path === undefined) return;
      if (skipped < offset) {
        skipped++;
        ignoring = true;
        return;
      }
      if (files.length >= limit) {
        hasMore = true;
        return 'stop';
      }
      current = { path, matches: [], more: false };
    } else if (msg.type === 'match') {
      if (ignoring || !current) return;
      if (perFile !== undefined && current.matches.length >= perFile) {
        current.more = true;
        return;
      }
      if (total >= totalCap) {
        truncated = true;
        current.more = current.matches.length > 0;
        finishFile();
        return 'stop';
      }
      const match = toMatch(msg);
      if (!match) return;
      current.matches.push(match);
      total++;
    } else {
      finishFile();
    }
  }

  try {
    await runLines(resolveRgPath(), args, { cwd: opts.cwd, signal: opts.signal, onLine });
  } catch (e) {
    if (e instanceof ExecError && e.exitCode === 1) return { files: [], hasMore: false, truncated };
    throw e;
  }
  finishFile();

  return { files, hasMore, truncated };
}

export async function ripgrepSearch(opts: RipgrepSearchOptions): Promise<RipgrepFileResult[]> {
  return (await ripgrepSearchPage(opts)).files;
}
