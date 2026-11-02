import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrsHandlers } from '../../../ipc/handlers/prs';
import { ReviewStore } from '../../../store/review';
import { FileLockService } from '../../../services/fileLock';
import { makeUserData, type UserData } from '../../support/tmp';
import { makeGitServices } from '../../support/services';
import type { GhService } from '../../../services/gh';
import type { GitService } from '../../../services/git';
import type { MockInstance } from 'vitest';

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
  let userData: UserData;
  const projectId = 'o__owners';

  beforeEach(async () => {
    userData = await makeUserData();
  });

  afterEach(async () => {
    await userData.cleanup();
  });

  async function owners(
    codeowners: string | null,
    changed: string[],
    codeownersPath = '.github/CODEOWNERS',
  ): Promise<Record<string, string[]> | null> {
    const repo = userData.paths.projectRepoDir(projectId);
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
    const services = makeGitServices(userData.paths);
    const handlers = new PrsHandlers(
      services.gh,
      services.git,
      new ReviewStore(userData.paths, new FileLockService()),
      { filter: (_projectId, items) => Promise.resolve([...items]) },
    ).toHandlerMap();
    return handlers['overview.owners']({ projectId, base, head }, { window: null });
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

describe('pr.merge and overview.range handlers', () => {
  let userData: UserData;

  beforeEach(async () => {
    userData = await makeUserData();
  });

  afterEach(async () => {
    await userData.cleanup();
  });

  function setup(): {
    handlers: ReturnType<PrsHandlers['toHandlerMap']>;
    mergePr: MockInstance<GhService['mergePr']>;
    viewPrHeadBase: MockInstance<GhService['viewPrHeadBase']>;
    prRange: MockInstance<GitService['prRange']>;
  } {
    const services = makeGitServices(userData.paths);
    vi.spyOn(services.gh, 'repoRefFor').mockResolvedValue({ owner: 'acme', repo: 'widgets' });
    const mergePr = vi.spyOn(services.gh, 'mergePr').mockResolvedValue(undefined);
    const viewPrHeadBase = vi
      .spyOn(services.gh, 'viewPrHeadBase')
      .mockResolvedValue({ headRefOid: 'h'.repeat(40), baseRefOid: 'b'.repeat(40) });
    const prRange = vi
      .spyOn(services.git, 'prRange')
      .mockResolvedValue({ base: 'm'.repeat(40), head: 'h'.repeat(40) });
    const handlers = new PrsHandlers(
      services.gh,
      services.git,
      new ReviewStore(userData.paths, new FileLockService()),
      { filter: (_projectId, items) => Promise.resolve([...items]) },
    ).toHandlerMap();
    return { handlers, mergePr, viewPrHeadBase, prRange };
  }

  it('merges the PR in the project repository with the requested method', async () => {
    const { handlers, mergePr } = setup();

    await handlers['pr.merge'](
      { projectId: 'acme__widgets', pr: 7, method: 'SQUASH' },
      { window: null },
    );

    expect(mergePr).toHaveBeenCalledWith('acme', 'widgets', 7, 'SQUASH');
  });

  it('resolves the range of a PR from its current head and base', async () => {
    const { handlers, viewPrHeadBase, prRange } = setup();

    const range = await handlers['overview.range'](
      { projectId: 'acme__widgets', pr: 7 },
      { window: null },
    );

    expect(viewPrHeadBase).toHaveBeenCalledWith('acme', 'widgets', 7);
    expect(prRange).toHaveBeenCalledWith('acme__widgets', {
      pr: 7,
      headRefOid: 'h'.repeat(40),
      baseRefOid: 'b'.repeat(40),
    });
    expect(range).toEqual({ base: 'm'.repeat(40), head: 'h'.repeat(40) });
  });
});
