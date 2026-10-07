import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GitService } from '../../../services/git';
import { GhService } from '../../../services/gh';
import { createPrsHandlers } from '../../../ipc/handlers/prs';
import { projectRepoDir } from '../../../paths';
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
  return (await execFileP('git', args, { cwd, env: ENV })).stdout.trim();
}

describe('overview.owners against a real repository', () => {
  let userData: TmpDir;
  const projectId = 'o__owners';

  beforeEach(async () => {
    userData = await makeTmpDir('overview-owners');
    __setUserDataDir(userData.path);
  });

  afterEach(async () => {
    await userData.cleanup();
  });

  async function owners(
    codeowners: string | null,
    changed: string[],
    codeownersPath = '.github/CODEOWNERS',
  ): Promise<Record<string, string[]> | null> {
    const repo = projectRepoDir(projectId);
    await mkdir(repo, { recursive: true });
    await git(repo, ['init', '-b', 'main']);
    await writeFile(join(repo, 'README.md'), 'hi\n');
    if (codeowners !== null) {
      await mkdir(dirname(join(repo, codeownersPath)), { recursive: true });
      await writeFile(join(repo, codeownersPath), codeowners);
    }
    await git(repo, ['add', '.']);
    await git(repo, ['commit', '-m', 'base']);
    const base = await git(repo, ['rev-parse', 'HEAD']);
    for (const f of changed) {
      await mkdir(dirname(join(repo, f)), { recursive: true });
      await writeFile(join(repo, f), 'x\n');
    }
    await git(repo, ['add', '.']);
    await git(repo, ['commit', '-m', 'change']);
    const head = await git(repo, ['rev-parse', 'HEAD']);
    const handlers = createPrsHandlers(new GhService(), new GitService());
    // The owners handler never reads the IPC event.
    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    return handlers['overview.owners'](
      { projectId, base, head },
      { event: Object.create(null), window: null },
    );
  }

  it('maps changed files to owners from .github/CODEOWNERS', async () => {
    const result = await owners('* @everyone\n*.ts @ts-team\n', ['a.ts', 'b.md']);
    expect(result).toEqual({ 'a.ts': ['@ts-team'], 'b.md': ['@everyone'] });
  });

  it('reads a CODEOWNERS file at the repository root', async () => {
    const result = await owners('* @root\n', ['a.md'], 'CODEOWNERS');
    expect(result).toEqual({ 'a.md': ['@root'] });
  });

  it('returns null when the repository has no CODEOWNERS file', async () => {
    expect(await owners(null, ['a.md'])).toBeNull();
  });

  it('lets a trailing-slash directory rule own nested files', async () => {
    const result = await owners('* @everyone\n/docs/ @docs\n', ['docs/a/b.md']);
    expect(result).toEqual({ 'docs/a/b.md': ['@docs'] });
  });

  it('a "docs/*" rule owns direct children but not nested files', async () => {
    const result = await owners('* @everyone\ndocs/* @team\n', ['docs/a.md', 'docs/a/b.md']);
    expect(result).toEqual({ 'docs/a.md': ['@team'], 'docs/a/b.md': ['@everyone'] });
  });

  it('honours rules with character classes', async () => {
    const result = await owners('* @everyone\n*.[ch] @c-team\n', ['src/a.c', 'src/a.js']);
    expect(result).toEqual({ 'src/a.c': ['@c-team'], 'src/a.js': ['@everyone'] });
  });
});
