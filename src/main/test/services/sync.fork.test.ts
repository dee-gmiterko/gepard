import {
  createSyncRepo,
  git,
  issueComment,
  remoteComments,
  setRemote,
  type RemotePr,
  type SyncRepo,
} from '../support/fakeGh';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GhService } from '../../services/gh';
import { GitService } from '../../services/git';
import { SyncService } from '../../services/sync';
import * as review from '../../store/review';
import { projectRepoDir } from '../../paths';
import { __setUserDataDir } from '../support/electron';
import { makeTmpDir, type TmpDir } from '../support/tmp';

const ctx = { owner: 'acme', repo: 'widgets' };

describe('fork pull requests (real repo with refs/pull/N/head, stubbed gh executable)', () => {
  let userData: TmpDir;
  let repo: SyncRepo;
  const gitSvc = new GitService();
  const gh = new GhService();
  const projectId = 'acme__forks';
  let sync: SyncService;
  let remote: RemotePr;

  beforeAll(async () => {
    userData = await makeTmpDir('sync-fork-ud');
    __setUserDataDir(userData.path);
    repo = await createSyncRepo(projectId, gitSvc, { fork: true });
    sync = new SyncService(gh, gitSvc);
    remote = {
      id: 'PR_1',
      headRefOid: repo.headOid,
      baseRefOid: repo.baseTip,
      fork: { owner: 'alice', name: 'widgets' },
    };
    await setRemote(remote);
  }, 60_000);

  afterAll(async () => {
    await repo.cleanup();
    await userData.cleanup();
  });

  it('exposes the fork origin of the PR', async () => {
    expect(await gh.viewPr('acme', 'widgets', 1)).toMatchObject({
      isCrossRepository: true,
      headRepository: { name: 'widgets' },
      headRepositoryOwner: { login: 'alice' },
    });
  });

  it('exposes a deleted fork as a cross-repository PR without a head repository', async () => {
    await setRemote({ ...remote, fork: 'deleted' });
    expect(await gh.viewPr('acme', 'widgets', 1)).toMatchObject({
      isCrossRepository: true,
      headRepository: null,
      headRepositoryOwner: null,
    });
    await setRemote(remote);
  });

  it('syncs a fork PR end to end: fetches the head, returns the merge-base, pushes a comment', async () => {
    const result = await sync.runSync(projectId, 1, ctx, undefined, 'pull');
    expect(result.head).toBe(repo.headOid);
    expect(await git(projectRepoDir(projectId), ['rev-parse', 'HEAD'])).toBe(repo.headOid);

    await review.upsertLocalComment(
      projectId,
      1,
      { prId: 'PR_1', commitOid: repo.headOid },
      { id: null, threadId: null, anchor: null, general: true, body: 'looks good', references: [] },
    );
    await sync.runSync(projectId, 1, ctx, undefined, 'full');
    expect((await remoteComments()).map((c) => c.body)).toEqual(['looks good']);
  });

  it('syncs a commit of a fork PR that is not local yet', async () => {
    await git(projectRepoDir(projectId), ['checkout', '--detach', repo.mergeBase]);
    await git(projectRepoDir(projectId), ['update-ref', '-d', 'refs/gepard/pr/1']);
    await git(projectRepoDir(projectId), ['reflog', 'expire', '--expire=now', '--all']);
    await git(projectRepoDir(projectId), ['gc', '--prune=now', '-q']);
    const result = await sync.runSync(projectId, 1, ctx, repo.headParent, 'pull');
    expect(result.head).toBe(repo.headParent);
  });

  it('keeps remote comments of a fork PR after a deleted fork', async () => {
    await setRemote({ ...remote, fork: 'deleted' }, [issueComment('IC_x', 'still here')]);
    await sync.runSync(projectId, 1, ctx, undefined, 'pull');
    const saved = await review.loadReview(projectId, 1);
    expect(saved.threads.map((t) => t.id)).toContain('IC_x');
  });
});
