import {
  issueComment,
  remoteComments,
  setRemote,
  createSyncRepo,
  type SyncRepo,
} from '../support/fakeGh';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GhService } from '../../services/gh';
import { GitService } from '../../services/git';
import { SyncService } from '../../services/sync';
import { mapGeneralComment } from '../../helpers/github/reviewMapping';
import * as review from '../../store/review';
import { __setUserDataDir } from '../support/electron';
import { makeTmpDir, type TmpDir } from '../support/tmp';

const ctx = { owner: 'acme', repo: 'widgets' };

describe(
  'SyncService.runSync against a real repo and a stubbed gh executable',
  { timeout: 60_000 },
  () => {
    let userData: TmpDir;
    let repo: SyncRepo;
    let sync: SyncService;
    let n = 0;
    let pr: number;
    const projectId = 'acme__widgets';
    const gitSvc = new GitService();

    const draft = (body: string): Promise<unknown> =>
      review.upsertLocalComment(
        projectId,
        pr,
        { prId: 'PR_1', commitOid: repo.headOid },
        {
          id: null,
          threadId: null,
          anchor: null,
          general: true,
          body,
          references: [],
        },
      );

    beforeAll(async () => {
      userData = await makeTmpDir('sync-full-ud');
      __setUserDataDir(userData.path);
      repo = await createSyncRepo('acme__widgets', gitSvc);
      await gitSvc.checkoutTarget('acme__widgets', {
        kind: 'pr',
        pr: 1,
        headRefOid: repo.headOid,
        baseRefOid: repo.baseTip,
      });
      sync = new SyncService(new GhService(), gitSvc);
    }, 60_000);

    afterAll(async () => {
      await repo.cleanup();
      await userData.cleanup();
    });

    beforeEach(async () => {
      pr = ++n;
      await setRemote({ id: 'PR_1', headRefOid: repo.headOid, baseRefOid: repo.baseTip });
    });

    const runFor = (mode: 'full' | 'pull'): Promise<void> => runWithStoreProject(mode);

    async function runWithStoreProject(mode: 'full' | 'pull'): Promise<void> {
      await sync.runSync(projectId, pr, ctx, undefined, mode);
    }

    it('full sync keeps a general comment pushed during the sync in the saved store', async () => {
      await draft('hello from local');
      await runFor('full');
      expect(await remoteComments()).toHaveLength(1);
      const saved = await review.loadReview(projectId, pr);
      expect(saved.threads.map((t) => t.comments[0]?.body)).toEqual(['hello from local']);
      expect(saved.threads[0]?.local).toBeUndefined();
    });

    it('full sync does not resurrect a comment whose deletion was pushed during the sync', async () => {
      const remote = issueComment('IC_old', 'to delete');
      await setRemote({ id: 'PR_1', headRefOid: repo.headOid, baseRefOid: repo.baseTip }, [remote]);
      await review.saveReview(projectId, pr, {
        threads: [mapGeneralComment(remote, 'PR_1')],
        viewed: [],
        pendingReviewId: null,
        lastSuccessfulSyncAt: null,
      });
      await review.deleteLocalComment(projectId, pr, 'IC_old');
      await runFor('full');
      expect(await remoteComments()).toEqual([]);
      expect((await review.loadReview(projectId, pr)).threads).toEqual([]);
    });

    it('full sync keeps unrelated remote comments next to a pushed one', async () => {
      await setRemote({ id: 'PR_1', headRefOid: repo.headOid, baseRefOid: repo.baseTip }, [
        issueComment('IC_other', 'someone else'),
      ]);
      await draft('mine');
      await runFor('full');
      const bodies = (await review.loadReview(projectId, pr)).threads
        .map((t) => t.comments[0]?.body)
        .sort();
      expect(bodies).toEqual(['mine', 'someone else']);
    });

    it('full sync with nothing local mirrors remote comments', async () => {
      await setRemote({ id: 'PR_1', headRefOid: repo.headOid, baseRefOid: repo.baseTip }, [
        issueComment('IC_a', 'a'),
      ]);
      await runFor('full');
      expect((await review.loadReview(projectId, pr)).threads.map((t) => t.id)).toEqual(['IC_a']);
    });

    it('pull sync neither pushes local drafts nor drops them', async () => {
      await draft('draft');
      await runFor('pull');
      expect(await remoteComments()).toEqual([]);
      const saved = await review.loadReview(projectId, pr);
      expect(saved.threads).toHaveLength(1);
      expect(saved.threads[0]?.local?.status).toBe('new');
    });

    it('pull sync imports remote comments and records no successful sync time', async () => {
      await setRemote({ id: 'PR_1', headRefOid: repo.headOid, baseRefOid: repo.baseTip }, [
        issueComment('IC_a', 'a'),
      ]);
      await runFor('pull');
      const saved = await review.loadReview(projectId, pr);
      expect(saved.threads.map((t) => t.id)).toEqual(['IC_a']);
      expect(saved.lastSuccessfulSyncAt).toBeNull();
    });
  },
);
