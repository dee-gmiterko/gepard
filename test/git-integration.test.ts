import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitService } from '../src/main/services/git';
import { nohooksDir, projectRepoDir } from '../src/main/paths';
import { __clearEmittedEvents, __setUserDataDir, emittedEvents } from './support/electron';
import { makeTmpDir, type TmpDir } from './support/tmp';

const execFileP = promisify(execFile);

const MACHINE_INDEPENDENT_GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'commit.gpgsign',
  GIT_CONFIG_VALUE_0: 'false',
};

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP('git', args, { cwd, env: MACHINE_INDEPENDENT_GIT_ENV });
  return stdout;
}

interface Fixture {
  rootSha: string;
  baseSha: string;
  featureHeadSha: string;
}

async function buildFixtureRepo(dir: string): Promise<Fixture> {
  await git(dir, ['init', '-b', 'main']);

  await writeFile(join(dir, 'README.md'), 'hello\n');
  await git(dir, ['add', '.']);
  await git(dir, ['commit', '-m', 'root commit']);
  const rootSha = (await git(dir, ['rev-parse', 'HEAD'])).trim();

  await writeFile(join(dir, 'a.txt'), 'line1\nline2\nline3\n');
  await mkdir(join(dir, 'sub'));
  await writeFile(join(dir, 'sub', 'b.txt'), 'b\n');
  await git(dir, ['add', '.']);
  await git(dir, ['commit', '-m', 'base commit']);
  const baseSha = (await git(dir, ['rev-parse', 'HEAD'])).trim();

  await git(dir, ['checkout', '-b', 'feature']);
  await writeFile(join(dir, 'a.txt'), 'line1\nCHANGED\nline3\nline4\n');
  await git(dir, ['mv', 'sub/b.txt', 'sub/c.txt']);
  await git(dir, ['rm', 'README.md']);
  await writeFile(
    join(dir, 'image.png'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255, 254]),
  );
  await git(dir, ['add', '.']);
  await git(dir, ['commit', '-m', 'feature: change files']);
  const featureHeadSha = (await git(dir, ['rev-parse', 'HEAD'])).trim();

  // git sets a clone's origin/HEAD from the branch checked out in the source repository.
  await git(dir, ['checkout', 'main']);

  return { rootSha, baseSha, featureHeadSha };
}

describe('GitService (integration)', () => {
  let origin: TmpDir;
  let userData: TmpDir;
  let fixture: Fixture;
  const projectId = 'acme__widgets';
  const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  const gitService = new GitService();

  beforeAll(async () => {
    origin = await makeTmpDir('git-origin');
    userData = await makeTmpDir('git-userdata');
    __setUserDataDir(userData.path);
    __clearEmittedEvents();
    fixture = await buildFixtureRepo(origin.path);
    await gitService.cloneProject(projectId, `file://${origin.path}`);
  }, 30_000);

  afterAll(async () => {
    await origin.cleanup();
    await userData.cleanup();
  });

  it('disables hooks on the clone (core.hooksPath -> the empty nohooks dir)', async () => {
    const repoRoot = projectRepoDir(projectId);
    const hooksPath = (await git(repoRoot, ['config', '--get', 'core.hooksPath'])).trim();
    expect(hooksPath).toBe(nohooksDir());
  });

  it('emits clone.progress events, ending in phase: done', () => {
    const progressEvents = emittedEvents.filter((e) => e.channel === 'clone.progress');
    expect(progressEvents.length).toBeGreaterThan(0);
    expect(progressEvents.at(-1)?.payload).toMatchObject({
      projectId,
      phase: 'done',
      percent: 100,
    });
  });

  it('checkoutTarget: a PR-like target resolves base to the merge-base of head/base', async () => {
    const result = await gitService.checkoutTarget(projectId, {
      kind: 'pr',
      pr: 1,
      headRefOid: fixture.featureHeadSha,
      baseRefOid: fixture.baseSha,
    });
    expect(result).toEqual({ base: fixture.baseSha, head: fixture.featureHeadSha });
  });

  it('checkoutTarget: a commit resolves base to its parent', async () => {
    const result = await gitService.checkoutTarget(projectId, {
      kind: 'commit',
      sha: fixture.baseSha,
    });
    expect(result).toEqual({ base: fixture.rootSha, head: fixture.baseSha });
  });

  it('checkoutTarget: a root commit resolves base to the empty tree', async () => {
    const result = await gitService.checkoutTarget(projectId, {
      kind: 'commit',
      sha: fixture.rootSha,
    });
    expect(result).toEqual({ base: EMPTY_TREE_SHA, head: fixture.rootSha });
  });

  it('changedFiles reports the modify, rename, delete, and added-binary between base and head', async () => {
    const changes = await gitService.changedFiles(
      projectId,
      fixture.baseSha,
      fixture.featureHeadSha,
    );
    const byPath = new Map(changes.map((c) => [c.path, c]));
    expect(byPath.get('a.txt')).toMatchObject({ changeType: 'MODIFIED', previousPath: null });
    expect(byPath.get('sub/c.txt')).toMatchObject({
      changeType: 'RENAMED',
      previousPath: 'sub/b.txt',
    });
    expect(byPath.get('README.md')).toMatchObject({ changeType: 'DELETED' });
    expect(byPath.get('image.png')).toMatchObject({
      changeType: 'ADDED',
      additions: 0,
      deletions: 0,
    });
  });

  it('listTree lists every tracked path at the feature head', async () => {
    const tree = await gitService.listTree(projectId, fixture.featureHeadSha);
    expect([...tree].sort()).toEqual(['a.txt', 'image.png', 'sub/c.txt']);
  });
});
