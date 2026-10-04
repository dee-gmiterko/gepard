import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { run, runBuffer, type RunResult } from '../helpers/process/exec';
import { looksBinary } from '../helpers/binary';
import { mimeForPath } from '../helpers/mime';
import {
  GIT_LOG_FORMAT,
  changeTypeFromLetter,
  parseCloneProgressLine,
  parseDiffTreeStdinFiles,
  parseGitLog,
  parseNameStatus,
  parseNumstat,
  parseUnifiedDiff,
  parseZTokens,
  selectDiffSection,
  stripOriginPrefix,
  type NameStatusEntry,
  parseBranchNames,
} from '../helpers/git/gitParsing';
import { emit } from '../ipc/registry';
import { indexer as defaultIndexer } from '../lsp';
import { nohooksDir, projectCloneTmpDir, projectRepoDir } from '../paths';
import { isCloned } from '../store/projects';
import { log } from '../log';
import {
  type ChangedFile,
  type Commit,
  type FileChange,
  type FileContent,
  type FileDiff,
  type ImageData,
  isGlob,
  matchesTarget,
  staticPrefixOf,
  AppError,
} from '@gepard/common';

const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// `GIT_TERMINAL_PROMPT=0` makes git fail instead of prompting for credentials.
const GIT_ENV: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
const GIT_TIMEOUT_MS = 2 * 60_000;

const GH_CREDENTIAL_ARGS = [
  '-c',
  'credential.helper=',
  '-c',
  'credential.helper=!gh auth git-credential',
];

const DEFAULT_LOG_LIMIT = 200;
const DEFAULT_BRANCH_REF = 'refs/remotes/origin/HEAD';
const GLOB_OVERFETCH_FACTOR = 5;
const GLOB_OVERFETCH_MAX = 20000;

export type CheckoutTarget =
  | { kind: 'pr'; pr: number; headRefOid: string; baseRefOid: string }
  | { kind: 'commit'; sha: string }
  | { kind: 'default' };

export interface BranchesInfo {
  branches: string[];
  defaultBranch: string | null;
}

interface Indexer {
  onCheckout(projectId: string, changes: FileChange[], newSha: string, fileCount: number): void;
}

export class GitService {
  private readonly checkoutQueues = new Map<string, Promise<unknown>>();
  private statusCache: { key: string; entries: Promise<NameStatusEntry[]> } | null = null;

  constructor(private readonly indexer: Indexer = defaultIndexer) {}

  private enqueue<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
    const settledPrior = (this.checkoutQueues.get(projectId) ?? Promise.resolve()).then(
      () => undefined,
      () => undefined,
    );
    const result = settledPrior.then(fn);
    this.checkoutQueues.set(
      projectId,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  }

  private gitRun(repoRoot: string, args: string[]): Promise<RunResult> {
    return run('git', [...GH_CREDENTIAL_ARGS, ...args], {
      cwd: repoRoot,
      env: GIT_ENV,
      timeoutMs: GIT_TIMEOUT_MS,
    });
  }

  cloneProject(projectId: string, url: string): Promise<void> {
    return this.enqueue(projectId, () => this.doCloneProject(projectId, url));
  }

  private async doCloneProject(projectId: string, url: string): Promise<void> {
    const repoDir = projectRepoDir(projectId);
    const tmpDir = projectCloneTmpDir(projectId);
    const nohooks = nohooksDir();
    try {
      if (await isCloned(projectId)) {
        emit('clone.progress', { projectId, phase: 'done', percent: 100 });
        return;
      }
      await mkdir(nohooks, { recursive: true });
      await mkdir(dirname(repoDir), { recursive: true });
      await rm(tmpDir, { recursive: true, force: true });

      await run(
        'git',
        [
          ...GH_CREDENTIAL_ARGS,
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
          tmpDir,
        ],
        {
          env: GIT_ENV,
          onStderrLine: (line) => {
            const progress = parseCloneProgressLine(line);
            if (progress) emit('clone.progress', { projectId, ...progress, message: line });
          },
        },
      );
      await rename(tmpDir, repoDir);
      emit('clone.progress', { projectId, phase: 'done', percent: 100 });
    } catch (e) {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
      const message = e instanceof Error ? e.message : String(e);
      log.error('clone', `projectId=${projectId} url=${url} failed: ${message}`);
      emit('clone.progress', {
        projectId,
        phase: 'error',
        percent: null,
        message,
      });
      throw e;
    }
  }

  private async currentHeadSha(repoRoot: string): Promise<string> {
    try {
      const { stdout } = await this.gitRun(repoRoot, ['rev-parse', 'HEAD']);
      return stdout.trim();
    } catch {
      return EMPTY_TREE_SHA; // `git rev-parse HEAD` fails before the first commit
    }
  }

  private async trackedFiles(repoRoot: string): Promise<string[]> {
    const { stdout } = await this.gitRun(repoRoot, ['ls-files', '-z']);
    return parseZTokens(stdout);
  }

  workingTree(projectId: string): Promise<{ head: string; files: string[] }> {
    return this.enqueue(projectId, async () => {
      const repoRoot = projectRepoDir(projectId);
      const [head, files] = await Promise.all([
        this.currentHeadSha(repoRoot),
        this.trackedFiles(repoRoot),
      ]);
      return { head, files };
    });
  }

  // LSP's FileChangeType has no rename event.
  private async changedPathsBetween(
    repoRoot: string,
    oldSha: string,
    newSha: string,
  ): Promise<FileChange[]> {
    if (oldSha === newSha) return [];
    const { stdout } = await this.gitRun(repoRoot, [
      'diff',
      '--name-status',
      '-z',
      '--find-renames',
      oldSha,
      newSha,
    ]);
    return parseNameStatus(parseZTokens(stdout)).flatMap((e): FileChange[] => {
      switch (e.status) {
        case 'R':
          return [
            { path: e.previousPath ?? e.path, type: 'deleted' },
            { path: e.path, type: 'created' },
          ];
        case 'C':
        case 'A':
          return [{ path: e.path, type: 'created' }];
        case 'D':
          return [{ path: e.path, type: 'deleted' }];
        default:
          return [{ path: e.path, type: 'changed' }];
      }
    });
  }

  private async hasRef(repoRoot: string, ref: string): Promise<boolean> {
    try {
      await this.gitRun(repoRoot, ['rev-parse', '--verify', '--quiet', ref]);
      return true;
    } catch {
      return false;
    }
  }

  private async hasCommit(repoRoot: string, sha: string): Promise<boolean> {
    try {
      await this.gitRun(repoRoot, ['cat-file', '-e', `${sha}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  }

  private async ensureCommit(repoRoot: string, sha: string): Promise<void> {
    if (await this.hasCommit(repoRoot, sha)) return;
    await this.gitRun(repoRoot, ['fetch', 'origin', '--prune']);
    if (!(await this.hasCommit(repoRoot, sha))) throw new Error(`commit ${sha} is not on origin`);
  }

  private async checkoutDetached(repoRoot: string, ref: string): Promise<void> {
    await this.gitRun(repoRoot, ['-c', 'advice.detachedHead=false', 'checkout', '--detach', ref]);
  }

  private async parentOrEmptyTree(repoRoot: string, sha: string): Promise<string> {
    try {
      const { stdout } = await this.gitRun(repoRoot, [
        'rev-parse',
        '--verify',
        '--quiet',
        `${sha}^`,
      ]);
      return stdout.trim();
    } catch {
      return EMPTY_TREE_SHA;
    }
  }

  private describeCheckoutTarget(target: CheckoutTarget): string {
    if (target.kind === 'pr')
      return `pr=${target.pr} head=${target.headRefOid} base=${target.baseRefOid}`;
    if (target.kind === 'commit') return `commit=${target.sha}`;
    return 'default';
  }

  async checkoutTarget(
    projectId: string,
    target: CheckoutTarget,
  ): Promise<{ base: string; head: string }> {
    return this.enqueue(projectId, async () => {
      const repoRoot = projectRepoDir(projectId);
      const oldSha = await this.currentHeadSha(repoRoot);
      log.info(
        'checkout',
        `projectId=${projectId} start from=${oldSha} target=${this.describeCheckoutTarget(target)}`,
      );

      let result: { base: string; head: string };
      if (target.kind === 'pr') {
        await this.ensureCommit(repoRoot, target.headRefOid);
        await this.checkoutDetached(repoRoot, target.headRefOid);
        const { stdout } = await this.gitRun(repoRoot, [
          'merge-base',
          target.baseRefOid,
          target.headRefOid,
        ]);
        result = { base: stdout.trim(), head: target.headRefOid };
      } else if (target.kind === 'commit') {
        await this.checkoutDetached(repoRoot, target.sha);
        result = { base: await this.parentOrEmptyTree(repoRoot, target.sha), head: target.sha };
      } else {
        // Check out the default branch from whatever origin/HEAD is known locally so
        // already-present content shows immediately; refresh origin in the background.
        await this.checkoutDetached(repoRoot, DEFAULT_BRANCH_REF);
        const head = await this.currentHeadSha(repoRoot);
        result = { base: head, head };
        this.fetchOrigin(projectId).catch((e) => {
          const message = e instanceof Error ? e.message : String(e);
          log.warn('checkout', `projectId=${projectId} background fetch origin failed: ${message}`);
        });
      }

      const [changes, files] = await Promise.all([
        this.changedPathsBetween(repoRoot, oldSha, result.head),
        this.trackedFiles(repoRoot),
      ]);
      this.indexer.onCheckout(projectId, changes, result.head, files.length);
      log.info('checkout', `projectId=${projectId} end base=${result.base} head=${result.head}`);
      return result;
    });
  }

  async listCommits(
    projectId: string,
    opts: { search?: string; path?: string; limit?: number } = {},
  ): Promise<Commit[]> {
    const repoRoot = projectRepoDir(projectId);
    const limit = opts.limit ?? DEFAULT_LOG_LIMIT;
    const globPath = opts.path !== undefined && isGlob(opts.path) ? opts.path : undefined;
    const glob = globPath !== undefined;
    const rev = (await this.hasRef(repoRoot, DEFAULT_BRANCH_REF)) ? DEFAULT_BRANCH_REF : 'HEAD';
    const pathspec = opts.path ? (glob ? staticPrefixOf(opts.path) : opts.path) : '';

    const runLog = async (count: number): Promise<Commit[]> => {
      const args = [
        'log',
        `--pretty=format:${GIT_LOG_FORMAT}`,
        '--date=iso-strict',
        '-n',
        String(count),
      ];
      if (opts.search) args.push('-i', `--grep=${opts.search}`);
      args.push(rev);
      if (pathspec) args.push('--', pathspec);
      const { stdout } = await this.gitRun(repoRoot, args);
      return parseGitLog(stdout);
    };

    if (globPath === undefined) return runLog(limit);

    let fetchCount = Math.min(Math.max(limit * GLOB_OVERFETCH_FACTOR, limit), GLOB_OVERFETCH_MAX);
    for (;;) {
      const commits = await runLog(fetchCount);
      const filesByOid = await this.filesTouchedByCommits(
        projectId,
        commits.map((c) => c.oid),
      );
      const matched = commits.filter((c) =>
        (filesByOid.get(c.oid) ?? []).some((f) => matchesTarget(f, globPath)),
      );
      const historyExhausted = commits.length < fetchCount;
      if (matched.length >= limit || historyExhausted || fetchCount >= GLOB_OVERFETCH_MAX) {
        return matched.slice(0, limit);
      }
      fetchCount = Math.min(fetchCount * 2, GLOB_OVERFETCH_MAX);
    }
  }

  fetchOrigin(projectId: string): Promise<void> {
    return this.enqueue(projectId, async () => {
      const repoRoot = projectRepoDir(projectId);
      await this.gitRun(repoRoot, ['fetch', 'origin', '--prune']);
    });
  }

  ensurePrCommitsFetched(projectId: string, oids: string[]): Promise<void> {
    return this.enqueue(projectId, async () => {
      if (oids.length === 0) return;
      const repoRoot = projectRepoDir(projectId);
      const newest = oids[oids.length - 1];
      await this.ensureCommit(repoRoot, newest);
    });
  }

  // git diff-tree fails on a missing object instead of fetching it.
  async filesTouchedByCommits(projectId: string, oids: string[]): Promise<Map<string, string[]>> {
    if (oids.length === 0) return new Map();
    const repoRoot = projectRepoDir(projectId);
    const { stdout } = await run(
      'git',
      ['diff-tree', '--stdin', '-r', '--name-only', '-z', '--format=%H'],
      {
        cwd: repoRoot,
        env: GIT_ENV,
        timeoutMs: GIT_TIMEOUT_MS,
        stdin: oids.join('\n') + '\n',
      },
    );
    return parseDiffTreeStdinFiles(stdout, oids);
  }

  async commitsTouchingPath(projectId: string, oids: string[], path: string): Promise<Set<string>> {
    if (oids.length === 0) return new Set();
    const filesByOid = await this.filesTouchedByCommits(projectId, oids);
    const result = new Set<string>();
    for (const [oid, files] of filesByOid) {
      if (files.some((f) => matchesTarget(f, path))) result.add(oid);
    }
    return result;
  }

  async changedFiles(projectId: string, base: string, head: string): Promise<ChangedFile[]> {
    const repoRoot = projectRepoDir(projectId);
    const [nameStatusRes, numstatRes] = await Promise.all([
      this.gitRun(repoRoot, ['diff', '--name-status', '-M', '-C', '-z', base, head]),
      this.gitRun(repoRoot, ['diff', '--numstat', '-M', '-C', '-z', base, head]),
    ]);
    const statuses = parseNameStatus(parseZTokens(nameStatusRes.stdout));
    const nums = parseNumstat(parseZTokens(numstatRes.stdout));
    if (statuses.length !== nums.length) {
      throw new AppError('GIT_DIFF_MISMATCH', 'git diff name-status/numstat entry count mismatch');
    }
    return statuses.map((s, i) => ({
      path: s.path,
      previousPath: s.previousPath,
      changeType: changeTypeFromLetter(s.status),
      additions: nums[i].additions ?? 0,
      deletions: nums[i].deletions ?? 0,
    }));
  }

  private async readBlobBuffer(repoRoot: string, ref: string): Promise<Buffer> {
    const { stdout } = await runBuffer('git', ['cat-file', 'blob', ref], {
      cwd: repoRoot,
      env: GIT_ENV,
      timeoutMs: GIT_TIMEOUT_MS,
    });
    return stdout;
  }

  private async blobExists(repoRoot: string, ref: string): Promise<boolean> {
    try {
      await this.gitRun(repoRoot, ['cat-file', '-e', ref]);
      return true;
    } catch {
      return false;
    }
  }

  async fileContentAt(projectId: string, sha: string, path: string): Promise<FileContent> {
    const repoRoot = projectRepoDir(projectId);
    const ref = `${sha}:${path}`;
    if (!(await this.blobExists(repoRoot, ref))) return { kind: 'missing', path, sha };
    const buf = await this.readBlobBuffer(repoRoot, ref);
    const mime = mimeForPath(path);
    if (mime) return { kind: 'image', path, sha, image: { mime, base64: buf.toString('base64') } };
    if (looksBinary(buf)) return { kind: 'binary', path, sha };
    return { kind: 'text', path, sha, text: buf.toString('utf8') };
  }

  private async readImageData(
    repoRoot: string,
    sha: string,
    path: string,
    mime: string,
  ): Promise<ImageData> {
    const buf = await this.readBlobBuffer(repoRoot, `${sha}:${path}`);
    return { mime, base64: buf.toString('base64') };
  }

  // A pathspec-scoped `git diff --name-status` loses rename detection because
  // the pathspec hides the old path from the comparison, so callers need the
  // whole-tree status.
  private statusEntriesFor(
    repoRoot: string,
    base: string,
    head: string,
  ): Promise<NameStatusEntry[]> {
    const key = `${repoRoot}\0${base}\0${head}`;
    if (this.statusCache?.key === key) return this.statusCache.entries;
    const entries = this.gitRun(repoRoot, ['diff', '--name-status', '-M', '-C', '-z', base, head])
      .then(({ stdout }) => parseNameStatus(parseZTokens(stdout)))
      .catch((e) => {
        if (this.statusCache?.key === key) this.statusCache = null;
        throw e;
      });
    this.statusCache = { key, entries };
    return entries;
  }

  private async statusEntryFor(
    repoRoot: string,
    base: string,
    head: string,
    path: string,
  ): Promise<NameStatusEntry | null> {
    const entries = await this.statusEntriesFor(repoRoot, base, head);
    return entries.find((e) => e.path === path) ?? null;
  }

  async fileDiff(projectId: string, base: string, head: string, path: string): Promise<FileDiff> {
    const repoRoot = projectRepoDir(projectId);
    const status = await this.statusEntryFor(repoRoot, base, head, path);
    const previousPath = status?.previousPath ?? null;
    const oldPath = previousPath ?? path;

    const [existsBase, existsHead] = await Promise.all([
      this.blobExists(repoRoot, `${base}:${oldPath}`),
      this.blobExists(repoRoot, `${head}:${path}`),
    ]);

    if (!existsBase && !existsHead) return { kind: 'missing', path };

    const probe = existsHead ? { sha: head, path } : { sha: base, path: oldPath };
    const probeBuf = await this.readBlobBuffer(repoRoot, `${probe.sha}:${probe.path}`);
    const mime = mimeForPath(probe.path);

    if (mime) {
      const [before, after] = await Promise.all([
        existsBase ? this.readImageData(repoRoot, base, oldPath, mime) : Promise.resolve(null),
        existsHead ? this.readImageData(repoRoot, head, path, mime) : Promise.resolve(null),
      ]);
      return { kind: 'image', path, previousPath, before, after };
    }

    if (looksBinary(probeBuf)) return { kind: 'binary', path, previousPath };

    const diffArgs = ['diff', '-U3', '--no-color'];
    if (previousPath) diffArgs.push('-M', '-C', base, head, '--', oldPath, path);
    else diffArgs.push(base, head, '--', path);
    const { stdout } = await this.gitRun(repoRoot, diffArgs);
    const section: string = previousPath ? selectDiffSection(stdout, oldPath, path) : stdout;
    return { kind: 'text', path, previousPath, rows: parseUnifiedDiff(section) };
  }

  async listTree(projectId: string, sha: string): Promise<string[]> {
    const repoRoot = projectRepoDir(projectId);
    const { stdout } = await this.gitRun(repoRoot, ['ls-tree', '-r', '--name-only', '-z', sha]);
    return parseZTokens(stdout);
  }

  // `refs/remotes/origin/HEAD` records the remote's default branch and is
  // absent when the remote reported no symref.
  private async resolveDefaultBranch(repoRoot: string): Promise<string | null> {
    try {
      const { stdout } = await this.gitRun(repoRoot, [
        'symbolic-ref',
        '--short',
        DEFAULT_BRANCH_REF,
      ]);
      return stripOriginPrefix(stdout.trim());
    } catch {
      return null;
    }
  }

  // A GitHub pull request can use only branches that exist on the remote.
  async listBranches(projectId: string): Promise<BranchesInfo> {
    const repoRoot = projectRepoDir(projectId);
    await this.gitRun(repoRoot, ['fetch', 'origin', '--prune']);
    const [refsOut, defaultBranch] = await Promise.all([
      this.gitRun(repoRoot, ['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin']),
      this.resolveDefaultBranch(repoRoot),
    ]);
    return { branches: parseBranchNames(refsOut.stdout), defaultBranch };
  }
}

export const gitService = new GitService();
