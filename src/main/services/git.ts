// Local `git` calls: clone with hooks disabled (report 04 §4.2), checkout,
// diff/tree/file-content plumbing (report 01 §2, report 03 §6), spawned
// through services/exec.ts's run/runJson/runBuffer (the single spawn point).
// Blob content (images, binary files) goes through `runBuffer` instead of
// `run`, since `run`'s UTF-8 decoding would corrupt arbitrary bytes.
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { run, runBuffer, type RunResult } from './exec'
import { AppError, emit } from '../ipc/registry'
import { indexer, type FileChange } from '../lsp'
import { nohooksDir, projectCloneTmpDir, projectRepoDir } from '../paths'
import { isCloned } from '../store/projects'
import { log } from '../log'
import type {
  ChangedFile,
  Commit,
  DiffRow,
  FileContent,
  FileDiff,
  ImageData
} from '@shared/ipc/schemas/pr'

type ChangeType = ChangedFile['changeType']

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

async function gitRun(repoRoot: string, args: string[]): Promise<RunResult> {
  return run('git', args, { cwd: repoRoot })
}

// ============================================================================
// Clone (report 04 §4.2)
// ============================================================================

const CLONE_PHASE_BY_LABEL: Record<
  string,
  'counting' | 'compressing' | 'receiving' | 'resolving' | 'checkout'
> = {
  'Counting objects': 'counting',
  'Compressing objects': 'compressing',
  'Receiving objects': 'receiving',
  'Resolving deltas': 'resolving',
  'Updating files': 'checkout'
}

// Server-side phases arrive prefixed with "remote: " (GitHub).
const CLONE_PROGRESS_RE =
  /^(?:remote: )?(Counting objects|Compressing objects|Receiving objects|Resolving deltas|Updating files):\s+(\d+)%/

export function parseCloneProgressLine(line: string): {
  phase: 'counting' | 'compressing' | 'receiving' | 'resolving' | 'checkout'
  percent: number
} | null {
  const m = CLONE_PROGRESS_RE.exec(line)
  if (!m) return null
  return { phase: CLONE_PHASE_BY_LABEL[m[1]], percent: Number(m[2]) }
}

/** Clones into `<userData>/projects/<id>/repo` with hooks disabled, emitting
 * `clone.progress`. Exactly report 04 §4.2's command, run into a temporary
 * directory that is renamed to `repo/` once the clone completed. */
export async function cloneProject(projectId: string, url: string): Promise<void> {
  const repoDir = projectRepoDir(projectId)
  const tmpDir = projectCloneTmpDir(projectId)
  const nohooks = nohooksDir()
  // Everything, including the preparation below, runs inside the try: the
  // caller (`clone.start`) swallows the rejection, so a failure that skipped
  // the catch would be neither logged nor pushed as a 'error' phase.
  try {
    if (await isCloned(projectId)) {
      emit('clone.progress', { projectId, phase: 'done', percent: 100 })
      return
    }
    await mkdir(nohooks, { recursive: true })
    await mkdir(dirname(repoDir), { recursive: true })
    // Leftover of an interrupted earlier clone.
    await rm(tmpDir, { recursive: true, force: true })

    await run(
      'git',
      [
        '-c',
        `core.hooksPath=${nohooks}`,
        '-c',
        'core.fsmonitor=false',
        '-c',
        'advice.detachedHead=false',
        'clone',
        '--progress',
        '--config',
        `core.hooksPath=${nohooks}`,
        '--config',
        'core.fsmonitor=false',
        url,
        tmpDir
      ],
      {
        onStderrLine: (line) => {
          const progress = parseCloneProgressLine(line)
          if (progress) emit('clone.progress', { projectId, ...progress, message: line })
        }
      }
    )
    await rename(tmpDir, repoDir)
    emit('clone.progress', { projectId, phase: 'done', percent: 100 })
  } catch (e) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
    const message = e instanceof Error ? e.message : String(e)
    log.error('clone', `projectId=${projectId} url=${url} failed: ${message}`)
    emit('clone.progress', {
      projectId,
      phase: 'error',
      percent: null,
      message
    })
    throw e
  }
}

// ============================================================================
// Checkout (report 04 §4.2, §5.2; report 03 §6): one serial job queue per
// project so a reindex never races a checkout.
// ============================================================================

const checkoutQueues = new Map<string, Promise<unknown>>()

function enqueue<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const settledPrior = (checkoutQueues.get(projectId) ?? Promise.resolve()).then(
    () => undefined,
    () => undefined
  )
  const result = settledPrior.then(fn)
  checkoutQueues.set(
    projectId,
    result.then(
      () => undefined,
      () => undefined
    )
  )
  return result
}

async function currentHeadSha(repoRoot: string): Promise<string> {
  try {
    const { stdout } = await gitRun(repoRoot, ['rev-parse', 'HEAD'])
    return stdout.trim()
  } catch {
    return EMPTY_TREE_SHA // unborn HEAD (freshly initialised, no commits yet)
  }
}

/** Every tracked path in the working tree (`git ls-files -z`, report 03 §6). */
async function trackedFiles(repoRoot: string): Promise<string[]> {
  const { stdout } = await gitRun(repoRoot, ['ls-files', '-z'])
  return parseZTokens(stdout)
}

/** The checked-out sha and tracked files (projects.open). Queued behind any
 * pending checkout so it never reports a head that is about to change. */
export function workingTree(projectId: string): Promise<{ head: string; files: string[] }> {
  return enqueue(projectId, async () => {
    const repoRoot = projectRepoDir(projectId)
    const [head, files] = await Promise.all([currentHeadSha(repoRoot), trackedFiles(repoRoot)])
    return { head, files }
  })
}

/** Paths changed between two checkouts, in the LSP FileChangeType vocabulary
 * (report 03 §6: `git diff --name-status -z --find-renames <old> <new>`).
 * A rename has no LSP equivalent: it is a delete of the old path plus a
 * create of the new one. */
async function changedPathsBetween(
  repoRoot: string,
  oldSha: string,
  newSha: string
): Promise<FileChange[]> {
  if (oldSha === newSha) return []
  const { stdout } = await gitRun(repoRoot, [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    oldSha,
    newSha
  ])
  return parseNameStatus(parseZTokens(stdout)).flatMap((e): FileChange[] => {
    switch (e.status) {
      case 'R':
        return [
          { path: e.previousPath ?? e.path, type: 'deleted' },
          { path: e.path, type: 'created' }
        ]
      case 'C':
      case 'A':
        return [{ path: e.path, type: 'created' }]
      case 'D':
        return [{ path: e.path, type: 'deleted' }]
      default:
        return [{ path: e.path, type: 'changed' }]
    }
  })
}

async function hasRef(repoRoot: string, ref: string): Promise<boolean> {
  try {
    await gitRun(repoRoot, ['rev-parse', '--verify', '--quiet', ref])
    return true
  } catch {
    return false
  }
}

async function hasCommit(repoRoot: string, sha: string): Promise<boolean> {
  try {
    await gitRun(repoRoot, ['cat-file', '-e', `${sha}^{commit}`])
    return true
  } catch {
    return false
  }
}

async function checkoutDetached(repoRoot: string, ref: string): Promise<void> {
  await gitRun(repoRoot, ['-c', 'advice.detachedHead=false', 'checkout', '--detach', ref])
}

async function parentOrEmptyTree(repoRoot: string, sha: string): Promise<string> {
  try {
    const { stdout } = await gitRun(repoRoot, ['rev-parse', '--verify', '--quiet', `${sha}^`])
    return stdout.trim()
  } catch {
    return EMPTY_TREE_SHA // root commit has no parent
  }
}

const DEFAULT_BRANCH_REF = 'refs/remotes/origin/HEAD'

function describeCheckoutTarget(
  target:
    | { kind: 'pr'; pr: number; headRefOid: string; baseRefOid: string }
    | { kind: 'commit'; sha: string }
    | { kind: 'default' }
): string {
  if (target.kind === 'pr')
    return `pr=${target.pr} head=${target.headRefOid} base=${target.baseRefOid}`
  if (target.kind === 'commit') return `commit=${target.sha}`
  return 'default'
}

/** Checks out a target in the project's single working tree and returns the
 * base/head diff pair (report 04 §5.2). Serialised per project; reindexes
 * via `indexer.onCheckout` after every checkout. `default` (no PR and no
 * commit targeted) fetches and checks out the default branch head
 * (`origin/HEAD`), falling back to the local ref when the fetch fails; it has
 * no diff, so base = head. */
export async function checkoutTarget(
  projectId: string,
  target:
    | { kind: 'pr'; pr: number; headRefOid: string; baseRefOid: string }
    | { kind: 'commit'; sha: string }
    | { kind: 'default' }
): Promise<{ base: string; head: string }> {
  return enqueue(projectId, async () => {
    const repoRoot = projectRepoDir(projectId)
    const oldSha = await currentHeadSha(repoRoot)
    log.info(
      'checkout',
      `projectId=${projectId} start from=${oldSha} target=${describeCheckoutTarget(target)}`
    )

    let result: { base: string; head: string }
    if (target.kind === 'pr') {
      // PR heads (forks included) are only reachable via refs/pull/N/head;
      // the base commit is normally already present from the clone.
      if (!(await hasCommit(repoRoot, target.headRefOid))) {
        await gitRun(repoRoot, [
          'fetch',
          'origin',
          `+refs/pull/${target.pr}/head:refs/ghlr/pr/${target.pr}`
        ])
      }
      if (!(await hasCommit(repoRoot, target.baseRefOid))) {
        await gitRun(repoRoot, ['fetch', 'origin', target.baseRefOid])
      }
      await checkoutDetached(repoRoot, target.headRefOid)
      const { stdout } = await gitRun(repoRoot, [
        'merge-base',
        target.baseRefOid,
        target.headRefOid
      ])
      result = { base: stdout.trim(), head: target.headRefOid }
    } else if (target.kind === 'commit') {
      await checkoutDetached(repoRoot, target.sha)
      result = { base: await parentOrEmptyTree(repoRoot, target.sha), head: target.sha }
    } else {
      // Fetch so the default branch is current (like GitHub's repo page);
      // offline or on a fetch error fall back to the clone's last state.
      try {
        await gitRun(repoRoot, ['fetch', 'origin'])
      } catch {
        // keep the local origin/HEAD
      }
      await checkoutDetached(repoRoot, DEFAULT_BRANCH_REF)
      const head = await currentHeadSha(repoRoot)
      result = { base: head, head }
    }

    const [changes, files] = await Promise.all([
      changedPathsBetween(repoRoot, oldSha, result.head),
      trackedFiles(repoRoot)
    ])
    indexer.onCheckout(projectId, changes, result.head, files.length)
    log.info('checkout', `projectId=${projectId} end base=${result.base} head=${result.head}`)
    return result
  })
}

// ============================================================================
// Commits (report 01 §2, report 04 §5.2)
// ============================================================================

const RS = '\x1e' // record separator between commits
const US = '\x1f' // unit separator between fields
const LOG_FORMAT = ['%H', '%ad', '%cd', '%an', '%ae', '%s', '%b'].join(US) + RS
const DEFAULT_LOG_LIMIT = 200

function parseGitLog(stdout: string): Commit[] {
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
        messageBody
      ] = record.split(US)
      return {
        oid,
        messageHeadline,
        messageBody: messageBody ?? '',
        authoredDate,
        committedDate,
        authors: [{ login: null, name: authorName, email: authorEmail }]
      }
    })
}

/** Commits of the default branch (`git log origin/HEAD`); `path` limits to
 * commits touching a targeted folder/file. */
export async function listCommits(
  projectId: string,
  opts: { search?: string; path?: string; limit?: number } = {}
): Promise<Commit[]> {
  const repoRoot = projectRepoDir(projectId)
  const args = [
    'log',
    `--pretty=format:${LOG_FORMAT}`,
    '--date=iso-strict',
    '-n',
    String(opts.limit ?? DEFAULT_LOG_LIMIT)
  ]
  if (opts.search) args.push('-i', `--grep=${opts.search}`)
  // The default branch, not HEAD: once a commit is targeted HEAD is that
  // commit, and listing from it would hide every newer commit.
  args.push((await hasRef(repoRoot, DEFAULT_BRANCH_REF)) ? DEFAULT_BRANCH_REF : 'HEAD')
  if (opts.path) args.push('--', opts.path)
  const { stdout } = await gitRun(repoRoot, args)
  return parseGitLog(stdout)
}

// ============================================================================
// Changed files (report 01 §2.2, report 04 §5.2)
// ============================================================================

function parseZTokens(stdout: string): string[] {
  const tokens = stdout.split('\0')
  if (tokens.length > 0 && tokens[tokens.length - 1] === '') tokens.pop()
  return tokens
}

interface NameStatusEntry {
  status: string
  path: string
  previousPath: string | null
}

/** `git diff --name-status -z`: plain entries are `<letter>\0<path>\0`;
 * renames/copies are `<letter+score>\0<oldPath>\0<newPath>\0`. */
export function parseNameStatus(tokens: string[]): NameStatusEntry[] {
  const out: NameStatusEntry[] = []
  let i = 0
  while (i < tokens.length) {
    const statusToken = tokens[i++]
    const letter = statusToken[0]
    if (letter === 'R' || letter === 'C') {
      const previousPath = tokens[i++]
      const path = tokens[i++]
      out.push({ status: letter, path, previousPath })
    } else {
      const path = tokens[i++]
      out.push({ status: letter, path, previousPath: null })
    }
  }
  return out
}

interface NumstatEntry {
  additions: number | null // null = binary ("-" from git)
  deletions: number | null
  path: string
}

const NUMSTAT_LINE_RE = /^(-|\d+)\t(-|\d+)\t(.*)$/

/** `git diff --numstat -z`: plain entries are one token `<add>\t<del>\t<path>`;
 * renames/copies are `<add>\t<del>\t\0<oldPath>\0<newPath>\0` (empty path in
 * the first token, then two more tokens). */
export function parseNumstat(tokens: string[]): NumstatEntry[] {
  const out: NumstatEntry[] = []
  let i = 0
  while (i < tokens.length) {
    const line = tokens[i++]
    const m = NUMSTAT_LINE_RE.exec(line)
    if (!m) throw new AppError('GIT_PARSE_ERROR', `unexpected numstat line: ${line}`)
    const [, addedStr, deletedStr, pathPart] = m
    const additions = addedStr === '-' ? null : Number(addedStr)
    const deletions = deletedStr === '-' ? null : Number(deletedStr)
    if (pathPart === '') {
      i++ // old path, unused: name-status already carries it
      const path = tokens[i++]
      out.push({ additions, deletions, path })
    } else {
      out.push({ additions, deletions, path: pathPart })
    }
  }
  return out
}

function changeTypeFromLetter(letter: string): ChangeType {
  switch (letter) {
    case 'A':
      return 'ADDED'
    case 'D':
      return 'DELETED'
    case 'R':
      return 'RENAMED'
    case 'C':
      return 'COPIED'
    case 'T':
      return 'CHANGED'
    default:
      return 'MODIFIED'
  }
}

/** Files changed between base/head (report 04 §5.2 diff pair). */
export async function changedFiles(
  projectId: string,
  base: string,
  head: string
): Promise<ChangedFile[]> {
  const repoRoot = projectRepoDir(projectId)
  const [nameStatusRes, numstatRes] = await Promise.all([
    gitRun(repoRoot, ['diff', '--name-status', '-M', '-C', '-z', base, head]),
    gitRun(repoRoot, ['diff', '--numstat', '-M', '-C', '-z', base, head])
  ])
  const statuses = parseNameStatus(parseZTokens(nameStatusRes.stdout))
  const nums = parseNumstat(parseZTokens(numstatRes.stdout))
  if (statuses.length !== nums.length) {
    throw new AppError('GIT_DIFF_MISMATCH', 'git diff name-status/numstat entry count mismatch')
  }
  return statuses.map((s, i) => ({
    path: s.path,
    previousPath: s.previousPath,
    changeType: changeTypeFromLetter(s.status),
    additions: nums[i].additions ?? 0,
    deletions: nums[i].deletions ?? 0,
    isBinary: nums[i].additions === null
  }))
}

// ============================================================================
// Blob content (report 04 §6 images; binary-safe via exec.ts's runBuffer)
// ============================================================================

async function readBlobBuffer(repoRoot: string, ref: string): Promise<Buffer> {
  const { stdout } = await runBuffer('git', ['cat-file', 'blob', ref], { cwd: repoRoot })
  return stdout
}

async function blobExists(repoRoot: string, ref: string): Promise<boolean> {
  try {
    await gitRun(repoRoot, ['cat-file', '-e', ref])
    return true
  } catch {
    return false
  }
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
}

export function mimeForPath(path: string): string | null {
  const dot = path.lastIndexOf('.')
  if (dot < 0) return null
  return IMAGE_MIME_BY_EXT[path.slice(dot).toLowerCase()] ?? null
}

/** git's own binary heuristic: a NUL byte in the first 8000 bytes. */
export function looksBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, 8000)
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

/** File content at a sha (spec viewers: code / image / missing). */
export async function fileContentAt(
  projectId: string,
  sha: string,
  path: string
): Promise<FileContent> {
  const repoRoot = projectRepoDir(projectId)
  const ref = `${sha}:${path}`
  if (!(await blobExists(repoRoot, ref))) return { kind: 'missing', path, sha }
  const buf = await readBlobBuffer(repoRoot, ref)
  const mime = mimeForPath(path)
  if (mime) return { kind: 'image', path, sha, image: { mime, base64: buf.toString('base64') } }
  if (looksBinary(buf)) return { kind: 'binary', path, sha }
  return { kind: 'text', path, sha, text: buf.toString('utf8') }
}

async function readImageData(
  repoRoot: string,
  sha: string,
  path: string,
  mime: string
): Promise<ImageData> {
  const buf = await readBlobBuffer(repoRoot, `${sha}:${path}`)
  return { mime, base64: buf.toString('base64') }
}

// ============================================================================
// File diff rows (report 02 decision: combined single-document model)
// ============================================================================

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/

export function parseUnifiedDiff(diffText: string): DiffRow[] {
  const lines = diffText.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()

  const rows: DiffRow[] = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  for (const line of lines) {
    const hunkMatch = HUNK_HEADER_RE.exec(line)
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1])
      newLine = Number(hunkMatch[2])
      inHunk = true
      rows.push({ kind: 'hunk', oldLine: null, newLine: null, text: line })
      continue
    }
    if (!inHunk) continue
    if (line.startsWith('\\')) continue // "\ No newline at end of file"

    const marker = line[0]
    const text = line.slice(1)
    if (marker === '+') {
      rows.push({ kind: 'add', oldLine: null, newLine, text })
      newLine++
    } else if (marker === '-') {
      rows.push({ kind: 'delete', oldLine, newLine: null, text })
      oldLine++
    } else if (marker === ' ') {
      rows.push({ kind: 'context', oldLine, newLine, text })
      oldLine++
      newLine++
    }
    // any other marker inside a hunk is not expected from `git diff -U3`
  }
  return rows
}

/** `git diff --name-status` restricted to a single path loses rename
 * detection (the pathspec hides the old file from the comparison), so this
 * always runs the whole-tree name-status diff and picks the matching entry;
 * it is cheap (paths/letters only, no content). */
async function statusEntryFor(
  repoRoot: string,
  base: string,
  head: string,
  path: string
): Promise<NameStatusEntry | null> {
  const { stdout } = await gitRun(repoRoot, ['diff', '--name-status', '-M', '-C', '-z', base, head])
  const entries = parseNameStatus(parseZTokens(stdout))
  return entries.find((e) => e.path === path) ?? null
}

/** Diff of one path between base and head (report 02, report 04 §6). */
export async function fileDiff(
  projectId: string,
  base: string,
  head: string,
  path: string
): Promise<FileDiff> {
  const repoRoot = projectRepoDir(projectId)
  const status = await statusEntryFor(repoRoot, base, head, path)
  const previousPath = status?.previousPath ?? null
  const oldPath = previousPath ?? path

  const [existsBase, existsHead] = await Promise.all([
    blobExists(repoRoot, `${base}:${oldPath}`),
    blobExists(repoRoot, `${head}:${path}`)
  ])

  if (!existsBase && !existsHead) return { kind: 'missing', path }

  const probe = existsHead ? { sha: head, path } : { sha: base, path: oldPath }
  const probeBuf = await readBlobBuffer(repoRoot, `${probe.sha}:${probe.path}`)
  const mime = mimeForPath(probe.path)

  if (mime) {
    const [before, after] = await Promise.all([
      existsBase ? readImageData(repoRoot, base, oldPath, mime) : Promise.resolve(null),
      existsHead ? readImageData(repoRoot, head, path, mime) : Promise.resolve(null)
    ])
    return { kind: 'image', path, previousPath, before, after }
  }

  if (looksBinary(probeBuf)) return { kind: 'binary', path, previousPath }

  const diffArgs = ['diff', '-U3', '--no-color']
  if (previousPath) diffArgs.push('-M', '-C', base, head, '--', oldPath, path)
  else diffArgs.push(base, head, '--', path)
  const { stdout } = await gitRun(repoRoot, diffArgs)
  return { kind: 'text', path, previousPath, rows: parseUnifiedDiff(stdout) }
}

// ============================================================================
// Trees (report 03 §7: every tracked file path at sha)
// ============================================================================

export async function listTree(projectId: string, sha: string): Promise<string[]> {
  const repoRoot = projectRepoDir(projectId)
  const { stdout } = await gitRun(repoRoot, ['ls-tree', '-r', '--name-only', '-z', sha])
  return parseZTokens(stdout)
}
