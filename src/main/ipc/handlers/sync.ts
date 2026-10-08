import type { HandlerMap } from '../registry';
import type { GhService } from '../../services/gh';
import type { SyncService } from '../../services/sync';
import { countPendingChanges } from '../../helpers/github/reviewMapping';
import * as review from '../../store/review';
import { indexer } from '../../lsp/indexer';

export function createSyncHandlers(
  gh: GhService,
  syncService: SyncService,
): Pick<HandlerMap, 'sync.run' | 'sync.pendingCount' | 'index.get' | 'index.languages'> {
  return {
    'sync.run': async ({ projectId, pr, commit, mode }) => {
      const { owner, repo } = await gh.repoRefFor(projectId);
      return syncService.runSync(projectId, pr, { owner, repo }, commit, mode);
    },

    'sync.pendingCount': async ({ projectId, pr }) => {
      const store = await review.loadReview(projectId, pr);
      return countPendingChanges(store);
    },

    'index.get': ({ projectId }) => indexer.status(projectId),

    'index.languages': ({ projectId }) => indexer.languages(projectId),
  };
}
