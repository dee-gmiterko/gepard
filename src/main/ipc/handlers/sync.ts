import type { HandlerMap } from '../registry'
import * as gh from '../../services/gh'
import * as syncService from '../../services/sync'
import * as review from '../../store/review'
import { indexer } from '../../lsp'

export const syncHandlers: Pick<HandlerMap, 'sync.run' | 'sync.pendingCount' | 'index.get'> = {
  'sync.run': async ({ projectId, pr, mode }) => {
    const { owner, repo } = await gh.repoRefFor(projectId)
    return syncService.runSync(projectId, pr, mode, { owner, repo })
  },

  'sync.pendingCount': async ({ projectId, pr }) => {
    const store = await review.loadReview(projectId, pr)
    return syncService.countPendingChanges(store)
  },

  'index.get': ({ projectId }) => indexer.status(projectId)
}
