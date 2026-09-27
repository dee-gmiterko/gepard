import type { HandlerMap } from '../registry'
import * as gh from '../../services/gh'
import * as git from '../../services/git'
import * as review from '../../store/review'

export const commentsHandlers: Pick<
  HandlerMap,
  'comments.list' | 'comments.upsert' | 'comments.delete' | 'viewed.list' | 'viewed.set'
> = {
  'comments.list': ({ projectId, pr }) => review.listThreads(projectId, pr),

  'comments.upsert': async (draft) => {
    const { projectId, pr, id, threadId, anchor, body, references } = draft
    const isNewThread = id === null && threadId === null && anchor !== null

    let ctx: review.UpsertContext = { prId: '', commitOid: '' }
    if (isNewThread) {
      const [{ owner, repo }, { head: commitOid }] = await Promise.all([
        gh.repoRefFor(projectId),
        git.workingTree(projectId)
      ])
      const { id: prId } = await gh.viewPr(owner, repo, pr)
      ctx = { prId, commitOid }
    }

    return review.upsertLocalComment(projectId, pr, ctx, { id, threadId, anchor, body, references })
  },

  'comments.delete': ({ projectId, pr, commentId }) =>
    review.deleteLocalComment(projectId, pr, commentId),

  'viewed.list': ({ projectId, pr }) => review.listViewed(projectId, pr),

  'viewed.set': async ({ projectId, pr, paths, viewed }) => {
    let prId = await review.knownPrId(projectId, pr)
    if (!prId) {
      const { owner, repo } = await gh.repoRefFor(projectId)
      prId = (await gh.viewPr(owner, repo, pr)).id
    }
    return review.setLocalViewed(projectId, pr, prId, paths, viewed)
  }
}
