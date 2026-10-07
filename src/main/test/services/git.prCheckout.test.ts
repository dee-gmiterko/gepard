import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitService } from '../../services/git';
import { __setUserDataDir } from '../support/electron';
import { makeTmpDir, type TmpDir } from '../support/tmp';

const execFileP = promisify(execFile);
const ENV = {
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
  const { stdout } = await execFileP('git', args, { cwd, env: ENV });
  return stdout.trim();
}
describe('GitService.checkoutTarget for pull requests (integration)', () => {
  let origin: TmpDir;
  let bare: TmpDir;
  let userData: TmpDir;
  const svc = new GitService();
  let rootSha: string;
  let mainTip: string;
  let featureSha: string;
  let forkSha: string;

  beforeAll(async () => {
    origin = await makeTmpDir('git-pr-origin');
    bare = await makeTmpDir('git-pr-bare');
    userData = await makeTmpDir('git-pr-ud');
    __setUserDataDir(userData.path);
    const o = origin.path;
    await git(o, ['init', '-b', 'main']);
    await writeFile(join(o, 'a.txt'), '1\n');
    await git(o, ['add', '.']);
    await git(o, ['commit', '-m', 'root']);
    rootSha = await git(o, ['rev-parse', 'HEAD']);
    await git(o, ['checkout', '-b', 'feature']);
    await writeFile(join(o, 'f.txt'), 'f\n');
    await git(o, ['add', '.']);
    await git(o, ['commit', '-m', 'feature']);
    featureSha = await git(o, ['rev-parse', 'HEAD']);
    await git(o, ['checkout', 'main']);
    await writeFile(join(o, 'a.txt'), '2\n');
    await git(o, ['commit', '-am', 'main advances']);
    mainTip = await git(o, ['rev-parse', 'HEAD']);

    await git(bare.path, ['clone', '--bare', o, '.']);
    const w = await makeTmpDir('git-pr-fork');
    try {
      await git(w.path, ['clone', o, '.']);
      await git(w.path, ['checkout', '-b', 'forkpr', rootSha]);
      await writeFile(join(w.path, 'fork.txt'), 'fork\n');
      await git(w.path, ['add', '.']);
      await git(w.path, ['commit', '-m', 'fork pr commit']);
      forkSha = await git(w.path, ['rev-parse', 'HEAD']);
      await git(w.path, ['push', bare.path, `${forkSha}:refs/pull/1/head`]);
    } finally {
      await w.cleanup();
    }
    await svc.cloneProject('acme__origin', `file://${o}`);
    await svc.cloneProject('acme__bare', `file://${bare.path}`);
  }, 60_000);

  afterAll(async () => {
    await origin.cleanup();
    await bare.cleanup();
    await userData.cleanup();
  });

  it('checks out a same-repo PR head and returns the merge-base as base', async () => {
    const result = await svc.checkoutTarget('acme__origin', {
      kind: 'pr',
      pr: 1,
      headRefOid: featureSha,
      baseRefOid: mainTip,
    });
    expect(result).toEqual({ base: rootSha, head: featureSha });
  });

  it('fails clearly for a commit that exists nowhere on the remote', async () => {
    await expect(
      svc.checkoutTarget('acme__bare', {
        kind: 'pr',
        pr: 9,
        headRefOid: 'c'.repeat(40),
        baseRefOid: mainTip,
      }),
    ).rejects.toThrow(/not on origin/);
  });

  it('succeeds for a fork PR commit reachable only via refs/pull/N/head', async () => {
    const result = await svc.checkoutTarget('acme__bare', {
      kind: 'pr',
      pr: 1,
      headRefOid: forkSha,
      baseRefOid: mainTip,
    });
    expect(result).toEqual({ base: rootSha, head: forkSha });
  });

  describe('fork PR head handling', () => {
    let n = 0;
    async function freshClone(): Promise<string> {
      const id = `acme__fork${n++}`;
      await svc.cloneProject(id, `file://${bare.path}`);
      return id;
    }

    it('reports PR_HEAD_UNAVAILABLE when refs/pull/N/head does not exist', async () => {
      const id = await freshClone();
      await expect(
        svc.checkoutTarget(id, {
          kind: 'pr',
          pr: 99,
          headRefOid: 'd'.repeat(40),
          baseRefOid: mainTip,
        }),
      ).rejects.toMatchObject({ code: 'PR_HEAD_UNAVAILABLE' });
    });

    it('reports PR_HEAD_CHANGED when the PR head moved past the requested sha', async () => {
      const id = await freshClone();
      await git(bare.path, ['update-ref', 'refs/pull/2/head', forkSha]);
      const error = await svc
        .checkoutTarget(id, {
          kind: 'pr',
          pr: 2,
          headRefOid: 'e'.repeat(40),
          baseRefOid: mainTip,
        })
        .catch((e: unknown) => e);
      expect(error).toMatchObject({ code: 'PR_HEAD_CHANGED' });
      expect(String(error)).toContain(forkSha);
    });

    it('fetches the moved base tip when the head is already local', async () => {
      const id = await freshClone();
      await writeFile(join(origin.path, 'later.txt'), 'later\n');
      await git(origin.path, ['add', '.']);
      await git(origin.path, ['commit', '-m', 'main moves again']);
      const newTip = await git(origin.path, ['rev-parse', 'HEAD']);
      await git(origin.path, ['push', bare.path, 'main']);
      const result = await svc.checkoutTarget(id, {
        kind: 'pr',
        pr: 1,
        headRefOid: featureSha,
        baseRefOid: newTip,
      });
      expect(result).toEqual({ base: rootSha, head: featureSha });
    });

    it('lists the commits of a fork PR touching a path', async () => {
      const id = await freshClone();
      await svc.ensurePrCommitsFetched(id, 1, [forkSha]);
      const touching = await svc.commitsTouchingPath(id, [forkSha], 'fork.txt');
      expect([...touching]).toEqual([forkSha]);
    });

    it('checks out a fork PR commit that is not local when told the PR', async () => {
      const id = await freshClone();
      const result = await svc.checkoutTarget(id, { kind: 'commit', sha: forkSha, pr: 1 });
      expect(result).toEqual({ base: rootSha, head: forkSha });
    });

    it('rejects a non-local commit without a PR', async () => {
      const id = await freshClone();
      await expect(svc.checkoutTarget(id, { kind: 'commit', sha: forkSha })).rejects.toThrow(
        /not on origin/,
      );
    });
  });
});
