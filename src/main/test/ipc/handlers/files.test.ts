import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { channels } from '@gepard/common';
import { createFilesHandlers } from '../../../ipc/handlers/files';
import { GitService } from '../../../services/git';
import { __setUserDataDir } from '../../support/electron';
import { makeTmpDir, type TmpDir } from '../../support/tmp';

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

describe('files.content over the real IPC contract and handler (integration)', () => {
  let origin: TmpDir;
  let userData: TmpDir;
  const svc = new GitService();
  const handlers = createFilesHandlers(svc);
  const projectId = 'acme__ipc';
  let sha: string;

  const validate = (
    path: string,
  ): ReturnType<typeof z.safeParse<(typeof channels)['files.content']['input']>> =>
    z.safeParse(channels['files.content'].input, { projectId, sha, path });

  beforeAll(async () => {
    origin = await makeTmpDir('files-ipc-origin');
    userData = await makeTmpDir('files-ipc-ud');
    __setUserDataDir(userData.path);
    const o = origin.path;
    await git(o, ['init', '-b', 'main']);
    await mkdir(join(o, 'src'));
    await writeFile(join(o, 'src', 'a.ts'), 'export const a = 1;\n');
    await writeFile(join(o, 'safe.txt'), 'safe\n');
    await git(o, ['add', '-A']);
    await git(o, ['commit', '-m', 'init']);
    sha = await git(o, ['rev-parse', 'HEAD']);
    await svc.cloneProject(projectId, `file://${o}`);
  }, 30_000);

  afterAll(async () => {
    await origin.cleanup();
    await userData.cleanup();
  });

  it('serves a plain nested path end to end', async () => {
    const parsed = validate('src/a.ts');
    if (!parsed.success) throw new Error('expected the contract to accept the path');
    // The content handler never reads the IPC event.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const ctx = { event: Object.create(null), window: null };
    expect(await handlers['files.content'](parsed.data, ctx)).toMatchObject({
      kind: 'text',
      text: 'export const a = 1;\n',
    });
  });

  it.each(['../a', 'src/../../a', '/etc/passwd', ''])('rejects %j', async (p) => {
    const parsed = validate(p);
    if (!parsed.success) return;
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    const ctx = { event: Object.create(null), window: null };
    await expect(handlers['files.content'](parsed.data, ctx)).rejects.toMatchObject({
      code: 'INVALID_PATH',
    });
  });

  it('accepts a file name containing a backslash and a newline', () => {
    expect(validate('we\\ird\nname.txt').success).toBe(true);
  });
});
