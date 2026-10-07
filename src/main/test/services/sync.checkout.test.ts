import { createSyncRepo, setRemote, type SyncRepo } from '../support/fakeGh';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GhService } from '../../services/gh';
import { GitService } from '../../services/git';
import { SyncService } from '../../services/sync';
import { __setUserDataDir } from '../support/electron';
import { makeTmpDir, type TmpDir } from '../support/tmp';

const ctx = { owner: 'acme', repo: 'widgets' };

describe(
  'SyncService.runSync checkout range (real repo, stubbed gh executable)',
  { timeout: 60_000 },
  () => {
    let userData: TmpDir;
    let repo: SyncRepo;
    const gitSvc = new GitService();
    const projectId = 'acme__range';
    let sync: SyncService;

    beforeAll(async () => {
      userData = await makeTmpDir('sync-range-ud');
      __setUserDataDir(userData.path);
      repo = await createSyncRepo(projectId, gitSvc);
      sync = new SyncService(new GhService(), gitSvc);
      await setRemote({ id: 'PR_1', headRefOid: repo.headOid, baseRefOid: repo.baseTip });
    }, 60_000);

    afterAll(async () => {
      await repo.cleanup();
      await userData.cleanup();
    });

    it('checks out the PR head and returns the merge-base as base when not yet checked out', async () => {
      await gitSvc.checkoutTarget(projectId, { kind: 'commit', sha: repo.mergeBase });
      const result = await sync.runSync(projectId, 1, ctx, undefined, 'pull');
      expect(result).toMatchObject({ base: repo.mergeBase, head: repo.headOid });
    });

    it('returns the merge-base as base, not the base branch tip, when the head is already checked out', async () => {
      expect(repo.mergeBase).not.toBe(repo.baseTip);
      const result = await sync.runSync(projectId, 1, ctx, undefined, 'pull');
      expect(result).toMatchObject({ base: repo.mergeBase, head: repo.headOid });
    });

    it('a commit-scoped sync spans the commit against its parent', async () => {
      const result = await sync.runSync(projectId, 1, ctx, repo.headOid, 'pull');
      expect(result).toMatchObject({ base: repo.headParent, head: repo.headOid });
    });
  },
);
