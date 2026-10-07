import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitService } from '../services/git';
import { __setUserDataDir } from './support/electron';
import { makeTmpDir, type TmpDir } from './support/tmp';

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
});
