import type { z } from 'zod';
import { ClonePhase, type ChangedFile, type Commit, type DiffRow, AppError } from '@gepard/common';

type ChangeType = ChangedFile['changeType'];

const GitCloneProgressPhase = ClonePhase.exclude(['done', 'error']);
type GitCloneProgressPhase = z.infer<typeof GitCloneProgressPhase>;

const CLONE_PHASE_BY_LABEL: Record<string, GitCloneProgressPhase> = {
  'Counting objects': 'counting',
  'Compressing objects': 'compressing',
  'Receiving objects': 'receiving',
  'Resolving deltas': 'resolving',
  'Updating files': 'checkout',
};

// git prefixes server-side progress phases with "remote: ".
const CLONE_PROGRESS_RE =
  /^(?:remote: )?(Counting objects|Compressing objects|Receiving objects|Resolving deltas|Updating files):\s+(\d+)%/;

export function parseCloneProgressLine(line: string): {
  phase: GitCloneProgressPhase;
  percent: number;
} | null {
  const m = CLONE_PROGRESS_RE.exec(line);
  if (!m) return null;
  return { phase: CLONE_PHASE_BY_LABEL[m[1]], percent: Number(m[2]) };
}

const RS = '\x1e';
const US = '\x1f';
export const GIT_LOG_FORMAT = ['%H', '%ad', '%cd', '%an', '%ae', '%s', '%b'].join(US) + RS;

export function parseGitLog(stdout: string): Commit[] {
  return stdout
    .split(RS)
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.length > 0)
    .map((record) => {
      const [
        oid,
        authoredDate,
        committedDate,
        authorName,
        authorEmail,
        messageHeadline,
        messageBody,
      ] = record.split(US);
      return {
        oid,
        messageHeadline,
        messageBody: messageBody ?? '',
        authoredDate,
        committedDate,
        authors: [{ login: null, name: authorName, email: authorEmail }],
      };
    });
}

// git C-quotes paths with unusual characters unless `-z` is given.
export function parseDiffTreeStdinFiles(
  stdout: string,
  oids: readonly string[],
): Map<string, string[]> {
  const known = new Set(oids);
  const map = new Map<string, string[]>();
  let current: string[] | null = null;
  const tokens = stdout.split('\0');
  if (tokens.length > 0 && tokens[tokens.length - 1] === '') tokens.pop();
  for (const raw of tokens) {
    // `--format=%H` output puts a blank line before each commit's path list.
    const token = raw.replace(/^\n/, '');
    if (token === '') continue;
    if (known.has(token)) {
      current = [];
      map.set(token, current);
      continue;
    }
    current?.push(token);
  }
  return map;
}

export function parseZTokens(stdout: string): string[] {
  const tokens = stdout.split('\0');
  if (tokens.length > 0 && tokens[tokens.length - 1] === '') tokens.pop();
  return tokens;
}

export interface NameStatusEntry {
  status: string;
  path: string;
  previousPath: string | null;
}

// `git diff --name-status -z` emits `<letter>\0<path>\0`, or
// `<letter+score>\0<oldPath>\0<newPath>\0` for renames and copies.
export function parseNameStatus(tokens: string[]): NameStatusEntry[] {
  const out: NameStatusEntry[] = [];
  let i = 0;
  while (i < tokens.length) {
    const statusToken = tokens[i++];
    const letter = statusToken[0];
    if (letter === 'R' || letter === 'C') {
      const previousPath = tokens[i++];
      const path = tokens[i++];
      out.push({ status: letter, path, previousPath });
    } else {
      const path = tokens[i++];
      out.push({ status: letter, path, previousPath: null });
    }
  }
  return out;
}

export interface NumstatEntry {
  additions: number | null; // git numstat prints "-" for binary files
  deletions: number | null;
  path: string;
}

const NUMSTAT_LINE_RE = /^(-|\d+)\t(-|\d+)\t(.*)$/;

// `git diff --numstat -z` emits `<add>\t<del>\t<path>`, or
// `<add>\t<del>\t\0<oldPath>\0<newPath>\0` for renames and copies.
export function parseNumstat(tokens: string[]): NumstatEntry[] {
  const out: NumstatEntry[] = [];
  let i = 0;
  while (i < tokens.length) {
    const line = tokens[i++];
    const m = NUMSTAT_LINE_RE.exec(line);
    if (!m) throw new AppError('GIT_PARSE_ERROR', `unexpected numstat line: ${line}`);
    const [, addedStr, deletedStr, pathPart] = m;
    const additions = addedStr === '-' ? null : Number(addedStr);
    const deletions = deletedStr === '-' ? null : Number(deletedStr);
    if (pathPart === '') {
      i++;
      const path = tokens[i++];
      out.push({ additions, deletions, path });
    } else {
      out.push({ additions, deletions, path: pathPart });
    }
  }
  return out;
}

export function changeTypeFromLetter(letter: string): ChangeType {
  switch (letter) {
    case 'A':
      return 'ADDED';
    case 'D':
      return 'DELETED';
    case 'R':
      return 'RENAMED';
    case 'C':
      return 'COPIED';
    case 'T':
      return 'CHANGED';
    default:
      return 'MODIFIED';
  }
}

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseUnifiedDiff(diffText: string): DiffRow[] {
  const lines = diffText.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of lines) {
    const hunkMatch = HUNK_HEADER_RE.exec(line);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[2]);
      inHunk = true;
      rows.push({ kind: 'hunk', oldLine: null, newLine: null, text: line });
      continue;
    }
    if (!inHunk) continue;
    if (line.startsWith('\\')) continue; // git's "\ No newline at end of file" marker

    const marker = line[0];
    const text = line.slice(1);
    if (marker === '+') {
      rows.push({ kind: 'add', oldLine: null, newLine, text });
      newLine++;
    } else if (marker === '-') {
      rows.push({ kind: 'delete', oldLine, newLine: null, text });
      oldLine++;
    } else if (marker === ' ') {
      rows.push({ kind: 'context', oldLine, newLine, text });
      oldLine++;
      newLine++;
    }
  }
  return rows;
}

// A copy's source can also have its own independent diff between base and
// head; scoping the pathspec to both paths then makes git print two
// concatenated "diff --git" sections, and parseUnifiedDiff would otherwise
// misread the second section's `--- +++` header as delete/add rows because it
// never resets after the first section's last hunk.
export function selectDiffSection(diffText: string, oldPath: string, newPath: string): string {
  const marker = `diff --git a/${oldPath} b/${newPath}`;
  const idx = diffText.indexOf(marker);
  if (idx === -1) return diffText;
  const rest = diffText.slice(idx + marker.length);
  const nextIdx = rest.indexOf('\ndiff --git ');
  return nextIdx === -1 ? rest : rest.slice(0, nextIdx);
}

export function stripOriginPrefix(ref: string): string {
  return ref.startsWith('origin/') ? ref.slice('origin/'.length) : ref;
}

// `git for-each-ref --format=%(refname:short)` prints remote heads prefixed
// `origin/`, including the symbolic `origin/HEAD`.
export function parseBranchNames(stdout: string): string[] {
  const names = new Set<string>();
  for (const line of stdout.split('\n')) {
    const ref = line.trim();
    if (!ref || ref === 'origin/HEAD') continue;
    names.add(stripOriginPrefix(ref));
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
