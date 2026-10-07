import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
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
describe('GitService file content and diff over unusual tree entries (integration)', () => {
  let origin: TmpDir;
  let userData: TmpDir;
  const svc = new GitService();
  const projectId = 'acme__files';
  const oids: Record<string, string> = {};

  async function commit(message: string): Promise<string> {
    await git(origin.path, ['add', '-A']);
    await git(origin.path, ['commit', '-m', message]);
    return git(origin.path, ['rev-parse', 'HEAD']);
  }

  beforeAll(async () => {
    origin = await makeTmpDir('git-files-origin');
    userData = await makeTmpDir('git-files-ud');
    __setUserDataDir(userData.path);
    const o = origin.path;
    await git(o, ['init', '-b', 'main']);
    await writeFile(join(o, 'x'), 'plain file\n');
    await writeFile(join(o, 'bin.dat'), Buffer.from([0, 1, 2, 3, 0, 255]));
    oids.file = await commit('file x');
    await writeFile(join(o, 'x'), 'plain file changed\n');
    oids.edited = await commit('edit x');
    await git(o, ['rm', '-q', 'x']);
    await mkdir(join(o, 'x'));
    await writeFile(join(o, 'x', 'y.txt'), 'y\n');
    oids.dir = await commit('replace file x by directory x');
    await svc.cloneProject(projectId, `file://${o}`);
  }, 30_000);

  afterAll(async () => {
    await origin.cleanup();
    await userData.cleanup();
  });

  describe('fileContentAt', () => {
    it('reads a text file', async () => {
      expect(await svc.fileContentAt(projectId, oids.file, 'x')).toMatchObject({
        kind: 'text',
        text: 'plain file\n',
      });
    });

    it('reports a binary file as binary', async () => {
      expect((await svc.fileContentAt(projectId, oids.file, 'bin.dat')).kind).toBe('binary');
    });

    it('reports a nonexistent path as missing', async () => {
      expect((await svc.fileContentAt(projectId, oids.file, 'nope.txt')).kind).toBe('missing');
    });

    it('does not reject for a path that is a directory at that commit', async () => {
      const res = await svc.fileContentAt(projectId, oids.dir, 'x');
      expect(['missing', 'binary']).toContain(res.kind);
    });
  });

  describe('fileDiff', () => {
    it('diffs a modified text file', async () => {
      expect((await svc.fileDiff(projectId, oids.file, oids.edited, 'x')).kind).toBe('text');
    });

    it('reports a path absent on both sides as missing', async () => {
      expect((await svc.fileDiff(projectId, oids.file, oids.edited, 'nope.txt')).kind).toBe(
        'missing',
      );
    });

    it('does not reject when a file was replaced by a directory', async () => {
      const res = await svc.fileDiff(projectId, oids.edited, oids.dir, 'x');
      expect(res.kind).toBeDefined();
    });
  });
});
