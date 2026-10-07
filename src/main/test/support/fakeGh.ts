import { execFile } from 'node:child_process';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { GqlIssueCommentRaw } from '@gepard/common';
import { GitService } from '../../services/git';
import { makeTmpDir, type TmpDir } from './tmp';

// Installs an executable `gh` stub at the front of PATH. It must be imported
// before anything that imports services/gh, which snapshots process.env at load.
const stubDir = mkdtempSync(join(tmpdir(), 'gepard-fake-gh-'));
const statePath = join(stubDir, 'state.json');
const SCRIPT = `#!/usr/bin/env node
const fs = require('node:fs');
const statePath = ${JSON.stringify(statePath)};
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const args = process.argv.slice(2);
const out = (v) => { fs.writeFileSync(statePath, JSON.stringify(state)); process.stdout.write(JSON.stringify(v)); };
const pr = state.pr;
if (args[0] === 'pr' && args[1] === 'view') {
  out({ number: 1, id: pr.id, title: 't', author: { login: 'me' }, headRefName: 'feature',
    baseRefName: 'main', headRefOid: pr.headRefOid, baseRefOid: pr.baseRefOid,
    isCrossRepository: Boolean(pr.fork),
    headRepository: pr.fork && pr.fork !== 'deleted' ? { id: 'R_1', name: pr.fork.name } : null,
    headRepositoryOwner: pr.fork && pr.fork !== 'deleted' ? { id: 'U_1', login: pr.fork.owner, name: null } : null,
    createdAt: '2024-01-01T00:00:00Z', changedFiles: 1, labels: [], url: 'https://github.com/acme/widgets/pull/1' });
} else if (args[0] === 'api' && args[1] === 'graphql') {
  const { query, variables } = JSON.parse(fs.readFileSync(0, 'utf8'));
  const page = { hasNextPage: false, endCursor: null };
  const prNode = (extra) => ({ data: { repository: { pullRequest: { id: pr.id, headRefOid: pr.headRefOid, baseRefOid: pr.baseRefOid, ...extra } } } });
  if (query.includes('reviewThreads(')) {
    out(prNode({ reviewThreads: { totalCount: 0, pageInfo: page, nodes: [] } }));
  } else if (query.includes('addComment(')) {
    const id = 'IC_pushed_' + (++state.counter);
    const now = new Date().toISOString();
    const c = { id, author: { login: 'me' }, body: variables.body, createdAt: now, updatedAt: now,
      lastEditedAt: null, viewerDidAuthor: true, viewerCanDelete: true };
    state.comments.push(c);
    out({ data: { addComment: { commentEdge: { node: c } } } });
  } else if (query.includes('deleteIssueComment')) {
    state.comments = state.comments.filter((c) => c.id !== variables.id);
    out({ data: { deleteIssueComment: { clientMutationId: null } } });
  } else if (query.includes('comments(first:50, after')) {
    out(prNode({ comments: { pageInfo: page, nodes: state.comments } }));
  } else if (query.includes('files(')) {
    out(prNode({ changedFiles: 0, files: { totalCount: 0, pageInfo: page, nodes: [] } }));
  } else {
    process.stderr.write('fake gh: unsupported query');
    process.exit(1);
  }
} else {
  process.stderr.write('fake gh: unsupported command ' + args.join(' '));
  process.exit(1);
}
`;
writeFileSync(join(stubDir, 'gh'), SCRIPT);
chmodSync(join(stubDir, 'gh'), 0o755);
process.env.PATH = `${stubDir}:${process.env.PATH ?? ''}`;

export interface RemotePr {
  id: string;
  headRefOid: string;
  baseRefOid: string;
  fork?: { owner: string; name: string } | 'deleted';
}

interface FakeGhState {
  pr: RemotePr;
  comments: GqlIssueCommentRaw[];
  counter: number;
}

export async function setRemote(pr: RemotePr, comments: GqlIssueCommentRaw[] = []): Promise<void> {
  const state: FakeGhState = { pr, comments, counter: 0 };
  await writeFile(statePath, JSON.stringify(state));
}

export async function remoteComments(): Promise<GqlIssueCommentRaw[]> {
  const raw: unknown = JSON.parse(await readFile(statePath, 'utf8'));
  return z.object({ comments: z.array(GqlIssueCommentRaw) }).parse(raw).comments;
}

export function issueComment(id: string, body: string): GqlIssueCommentRaw {
  return {
    id,
    author: { login: 'me' },
    body,
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    lastEditedAt: null,
    viewerDidAuthor: true,
    viewerCanDelete: true,
  };
}

const execFileP = promisify(execFile);
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'commit.gpgsign',
  GIT_CONFIG_VALUE_0: 'false',
};
export async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP('git', args, { cwd, env: GIT_ENV });
  return stdout.trim();
}

export interface SyncRepo {
  headOid: string;
  baseTip: string;
  mergeBase: string;
  headParent: string;
  originPath: string;
  cleanup: () => Promise<void>;
}

// A bare origin with main advanced past the point where feature branched off,
// cloned as `projectId` by the real GitService. Requires __setUserDataDir first.
export async function createSyncRepo(
  projectId: string,
  svc: GitService,
  opts: { fork?: boolean } = {},
): Promise<SyncRepo> {
  const work: TmpDir = await makeTmpDir('sync-work');
  const bare: TmpDir = await makeTmpDir('sync-bare');
  const w = work.path;
  await git(w, ['init', '-b', 'main']);
  await writeFile(join(w, 'a.txt'), '1\n');
  await git(w, ['add', '.']);
  await git(w, ['commit', '-m', 'root']);
  const mergeBase = await git(w, ['rev-parse', 'HEAD']);
  await git(w, ['checkout', '-b', 'feature']);
  await mkdir(join(w, 'src'));
  await writeFile(join(w, 'src', 'f.txt'), 'f\n');
  await git(w, ['add', '.']);
  await git(w, ['commit', '-m', 'feature 1']);
  const headParent = await git(w, ['rev-parse', 'HEAD']);
  await writeFile(join(w, 'src', 'g.txt'), 'g\n');
  await git(w, ['add', '.']);
  await git(w, ['commit', '-m', 'feature 2']);
  const headOid = await git(w, ['rev-parse', 'HEAD']);
  await git(w, ['checkout', 'main']);
  await writeFile(join(w, 'a.txt'), '2\n');
  await git(w, ['commit', '-am', 'main advances']);
  const baseTip = await git(w, ['rev-parse', 'HEAD']);
  await git(bare.path, ['clone', '--bare', w, '.']);
  if (opts.fork) {
    // A fork PR head exists on the base repo only as refs/pull/N/head.
    await git(bare.path, ['update-ref', 'refs/pull/1/head', headOid]);
    await git(bare.path, ['branch', '-D', 'feature']);
  }
  await svc.cloneProject(projectId, `file://${bare.path}`);
  return {
    headOid,
    baseTip,
    mergeBase,
    headParent,
    originPath: bare.path,
    cleanup: async () => {
      await work.cleanup();
      await bare.cleanup();
    },
  };
}
