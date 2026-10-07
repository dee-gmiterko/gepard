import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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
describe('GitService.listCommits (integration)', () => {
  let origin: TmpDir;
  let userData: TmpDir;
  const svc = new GitService();
  const projectId = 'acme__history';
  const oids: Record<string, string> = {};

  async function commit(message: string): Promise<string> {
    await git(origin.path, ['add', '.']);
    await git(origin.path, ['commit', '-m', message]);
    return git(origin.path, ['rev-parse', 'HEAD']);
  }

  beforeAll(async () => {
    origin = await makeTmpDir('git-history-origin');
    userData = await makeTmpDir('git-history-ud');
    __setUserDataDir(userData.path);
    const o = origin.path;
    await git(o, ['init', '-b', 'main']);
    await mkdir(join(o, 'src'));
    await writeFile(join(o, 'src', 'a.ts'), 'a\n');
    oids.root = await commit('initial: add sources, literal foo[ and a(');
    await writeFile(join(o, 'other.md'), 'o\n');
    oids.unrelated = await commit('unrelated change');
    await writeFile(join(o, 'src', 'b.ts'), 'b\n');
    oids.second = await commit('add b');
    await svc.cloneProject(projectId, `file://${o}`);
  }, 30_000);

  afterAll(async () => {
    await origin.cleanup();
    await userData.cleanup();
  });

  const oidsOf = (commits: { oid: string }[]): string[] => commits.map((c) => c.oid);

  describe('search', () => {
    it('matches case-insensitively on plain text', async () => {
      expect(oidsOf(await svc.listCommits(projectId, { search: 'UNRELATED' }))).toEqual([
        oids.unrelated,
      ]);
    });

    it('returns nothing when no message matches', async () => {
      expect(await svc.listCommits(projectId, { search: 'zzz-no-such' })).toEqual([]);
    });

    it('treats an unbalanced bracket as literal text', async () => {
      expect(oidsOf(await svc.listCommits(projectId, { search: 'foo[' }))).toEqual([oids.root]);
    });

    it('treats a parenthesis as literal text', async () => {
      expect(oidsOf(await svc.listCommits(projectId, { search: 'a(' }))).toEqual([oids.root]);
    });

    it('does not interpret "." as a regex wildcard', async () => {
      expect(await svc.listCommits(projectId, { search: 'unrelated.change' })).toEqual([]);
    });
  });

  describe('glob path filter', () => {
    it('includes the root commit that added matching files', async () => {
      expect(oidsOf(await svc.listCommits(projectId, { path: 'src/*.ts' }))).toEqual([
        oids.second,
        oids.root,
      ]);
    });

    it('excludes commits that touch no matching file', async () => {
      expect(oidsOf(await svc.listCommits(projectId, { path: 'src/*.ts' }))).not.toContain(
        oids.unrelated,
      );
    });

    it('a literal path lists the commits touching it', async () => {
      expect(oidsOf(await svc.listCommits(projectId, { path: 'other.md' }))).toEqual([
        oids.unrelated,
      ]);
    });

    it('a glob matching nothing returns no commits', async () => {
      expect(await svc.listCommits(projectId, { path: 'src/*.py' })).toEqual([]);
    });
  });
});
