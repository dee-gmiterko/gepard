import type { HandlerMap } from '../registry';
import type { GhService } from '../../services/gh';
import type { SyncService } from '../../services/sync';
import { countPendingChanges } from '../../helpers/github/reviewMapping';
import * as review from '../../store/review';
import type { IndexerService } from '../../lsp/indexer';

export class SyncHandlers {
  constructor(
    private readonly gh: GhService,
    private readonly sync: SyncService,
    private readonly indexer: IndexerService,
  ) {}

  toHandlerMap(): Pick<
    HandlerMap,
    'sync.run' | 'sync.pendingCount' | 'index.get' | 'index.languages'
  > {
    return {
      'sync.run': async ({ projectId, pr, commit, mode }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        return this.sync.runSync(projectId, pr, { owner, repo }, commit, mode);
      },

      'sync.pendingCount': async ({ projectId, pr }) => {
        const store = await review.loadReview(projectId, pr);
        return countPendingChanges(store);
      },

      'index.get': ({ projectId }) => this.indexer.status(projectId),

      'index.languages': ({ projectId }) => this.indexer.languages(projectId),
    };
  }
}
