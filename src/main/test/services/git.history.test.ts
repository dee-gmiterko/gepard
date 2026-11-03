import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitService } from '../../services/git';
import { makeUserData, makeTmpDir, type TmpDir, type UserData } from '../support/tmp';
import { makeGitServices } from '../support/services';

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
  let userData: UserData;
  let svc: GitService;
  const projectId = 'acme__history';
  const oids: Record<string, string> = {};

  async function commit(message: string): Promise<string> {
    await git(origin.path, ['add', '.']);
    await git(origin.path, ['commit', '-m', message]);
    return git(origin.path, ['rev-parse', 'HEAD']);
  }

  beforeAll(async () => {
    origin = await makeTmpDir('git-history-origin');
    userData = await makeUserData();
    svc = makeGitServices(userData.paths).git;
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

describe('GitService.graphPage (integration)', () => {
  let origin: TmpDir;
  let userData: UserData;
  let svc: GitService;
  const projectId = 'acme__graph';
  const oids: Record<string, string> = {};

  async function commit(message: string): Promise<string> {
    await git(origin.path, ['commit', '--allow-empty', '-m', message]);
    return git(origin.path, ['rev-parse', 'HEAD']);
  }

  beforeAll(async () => {
    origin = await makeTmpDir('git-graph-origin');
    userData = await makeUserData();
    svc = makeGitServices(userData.paths).git;
    const o = origin.path;
    await git(o, ['init', '-b', 'main']);
    oids.root = await commit('root');
    await git(o, ['checkout', '-b', 'topic']);
    oids.topic = await commit('topic work');
    await git(o, ['checkout', 'main']);
    oids.main = await commit('main work');
    await git(o, ['merge', '--no-ff', 'topic', '-m', 'merge topic']);
    oids.merge = await git(o, ['rev-parse', 'HEAD']);
    await git(o, ['tag', 'v1']);
    await svc.cloneProject(projectId, `file://${o}`);
  }, 30_000);

  afterAll(async () => {
    await origin.cleanup();
    await userData.cleanup();
  });

  it('lists every commit with parents and ref decorations, children before parents', async () => {
    const page = await svc.graphPage(projectId, { offset: 0, limit: 10 });

    expect(page.nextOffset).toBeNull();
    expect(page.commits.map((c) => c.messageHeadline)).toEqual(
      expect.arrayContaining(['merge topic', 'main work', 'topic work', 'root']),
    );
    const byOid = new Map(page.commits.map((c) => [c.oid, c]));
    const merge = byOid.get(oids.merge);
    expect(merge?.parents).toEqual([oids.main, oids.topic]);
    expect(merge?.refs).toEqual(expect.arrayContaining(['main', 'v1']));
    expect(byOid.get(oids.topic)?.refs).toContain('topic');
    expect(byOid.get(oids.root)?.parents).toEqual([]);
    const index = (oid: string): number => page.commits.findIndex((c) => c.oid === oid);
    expect(index(oids.merge)).toBeLessThan(index(oids.main));
    expect(index(oids.main)).toBeLessThan(index(oids.root));
  });

  it('pages by offset and reports where the next page starts', async () => {
    const first = await svc.graphPage(projectId, { offset: 0, limit: 2 });
    const second = await svc.graphPage(projectId, { offset: 2, limit: 2 });

    expect(first.commits).toHaveLength(2);
    expect(first.nextOffset).toBe(2);
    expect(second.commits).toHaveLength(2);
    expect(second.nextOffset).toBeNull();
    expect(new Set([...first.commits, ...second.commits].map((c) => c.oid)).size).toBe(4);
  });
});
