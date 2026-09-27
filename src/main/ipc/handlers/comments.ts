import type { HandlerMap } from '../registry'
import * as gh from '../../services/gh'
import * as review from '../../store/review'

export const commentsHandlers: Pick<
  HandlerMap,
  'comments.list' | 'comments.upsert' | 'comments.delete' | 'viewed.list' | 'viewed.set'
> = {
  'comments.list': ({ projectId, pr }) => review.listThreads(projectId, pr),

  'comments.upsert': async (draft) => {
    const { projectId, pr, id, threadId, anchor, body, references } = draft
    const isNewComment = id === null
    const isNewThread = isNewComment && threadId === null && anchor !== null

    let ctx: review.UpsertContext = { prId: '', headRefOid: '', viewerLogin: '' }
    if (isNewThread) {
      const { owner, repo } = await gh.repoRefFor(projectId)
      const [{ id: prId, headRefOid }, viewerLogin] = await Promise.all([
        gh.viewPr(owner, repo, pr),
        gh.currentUserLogin()
      ])
      ctx = { prId, headRefOid, viewerLogin }
    } else if (isNewComment) {
      ctx = { prId: '', headRefOid: '', viewerLogin: await gh.currentUserLogin() }
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
