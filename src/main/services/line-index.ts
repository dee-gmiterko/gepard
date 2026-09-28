import { comparePaths } from '@gepard/common/model/pathOrder';

const WORD_RE =
  /[\p{Alphabetic}\p{Mark}\p{Decimal_Number}\p{Connector_Punctuation}\p{Join_Control}]+/gu;

export interface LineIndexMatch {
  line: number;
  preview: string;
  spans: Array<[number, number]>;
}

export interface LineIndexFileMatches {
  path: string;
  matches: LineIndexMatch[];
}

interface WordOccurrence {
  line: number;
  start: number;
  end: number;
}

interface FileEntry {
  lines: string[];
  lineKeys: Set<string>;
  wordKeys: Set<string>;
}

type Bucket<T> = Map<string, T[]>;

function pushEntry<T>(map: Map<string, Bucket<T>>, key: string, path: string, value: T): void {
  let bucket = map.get(key);
  if (!bucket) {
    bucket = new Map();
    map.set(key, bucket);
  }
  const list = bucket.get(path);
  if (list) list.push(value);
  else bucket.set(path, [value]);
}

function removeFromBucket<T>(map: Map<string, Bucket<T>>, key: string, path: string): void {
  const bucket = map.get(key);
  if (!bucket) return;
  bucket.delete(path);
  if (bucket.size === 0) map.delete(key);
}

function trimmedSpan(raw: string, trimmed: string): [number, number] {
  if (trimmed.length === 0) return [0, 0];
  const start = raw.length - raw.trimStart().length;
  return [start, start + trimmed.length];
}

export class LineIndex {
  private files = new Map<string, FileEntry>();
  private byLine = new Map<string, Bucket<number>>();
  private byWord = new Map<string, Bucket<WordOccurrence>>();

  get fileCount(): number {
    return this.files.size;
  }

  setFile(path: string, text: string): void {
    this.removeFile(path);
    const rawLines = text.split('\n');
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') rawLines.pop();
    const lines = rawLines.map((l) => l.trimEnd());
    const lineKeys = new Set<string>();
    const wordKeys = new Set<string>();

    lines.forEach((raw, i) => {
      const lineNo = i + 1;
      const trimmed = raw.trim();
      lineKeys.add(trimmed);
      pushEntry(this.byLine, trimmed, path, lineNo);

      WORD_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WORD_RE.exec(raw))) {
        wordKeys.add(m[0]);
        pushEntry(this.byWord, m[0], path, {
          line: lineNo,
          start: m.index,
          end: m.index + m[0].length,
        });
      }
    });

    this.files.set(path, { lines, lineKeys, wordKeys });
  }

  removeFile(path: string): void {
    const entry = this.files.get(path);
    if (!entry) return;
    this.files.delete(path);
    for (const key of entry.lineKeys) removeFromBucket(this.byLine, key, path);
    for (const key of entry.wordKeys) removeFromBucket(this.byWord, key, path);
  }

  queryExactLine(
    trimmed: string,
    exclude?: { path: string; line: number },
  ): LineIndexFileMatches[] {
    const bucket = this.byLine.get(trimmed);
    if (!bucket || bucket.size === 0) return [];

    const results: LineIndexFileMatches[] = [];
    for (const [path, lineNos] of bucket) {
      const file = this.files.get(path);
      if (!file) continue;
      const kept =
        exclude && exclude.path === path
          ? lineNos.filter((line) => line !== exclude.line)
          : lineNos;
      if (kept.length === 0) continue;
      const matches = kept
        .slice()
        .sort((a, b) => a - b)
        .map((line) => {
          const raw = file.lines[line - 1] ?? '';
          return { line, preview: raw, spans: [trimmedSpan(raw, trimmed)] };
        });
      results.push({ path, matches });
    }
    return results.sort((a, b) => comparePaths(a.path, b.path));
  }

  queryWord(word: string): LineIndexFileMatches[] {
    const bucket = this.byWord.get(word);
    if (!bucket || bucket.size === 0) return [];

    const results: LineIndexFileMatches[] = [];
    for (const [path, occurrences] of bucket) {
      const file = this.files.get(path);
      if (!file) continue;
      const byLineMap = new Map<number, Array<[number, number]>>();
      for (const occ of occurrences) {
        const spans = byLineMap.get(occ.line);
        if (spans) spans.push([occ.start, occ.end]);
        else byLineMap.set(occ.line, [[occ.start, occ.end]]);
      }
      const matches = Array.from(byLineMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([line, spans]) => ({
          line,
          preview: file.lines[line - 1] ?? '',
          spans: spans.slice().sort((a, b) => a[0] - b[0]),
        }));
      results.push({ path, matches });
    }
    return results.sort((a, b) => comparePaths(a.path, b.path));
  }
}
