// Sync domain: the explicit push/pull Sync button (report 01 §8) and the
// index-status readback for the currently opened project. Delegates to
// services/sync.ts and lsp's `indexer`.
import type { HandlerMap } from '../registry'
import * as gh from '../../services/gh'
import * as syncService from '../../services/sync'
import { indexer } from '../../lsp'

export const syncHandlers: Pick<HandlerMap, 'sync.run' | 'index.get'> = {
  'sync.run': async ({ projectId, pr, mode }) => {
    const { owner, repo } = await gh.repoRefFor(projectId)
    return syncService.runSync(projectId, pr, mode, { owner, repo })
  },

  'index.get': ({ projectId }) => indexer.status(projectId)
}
