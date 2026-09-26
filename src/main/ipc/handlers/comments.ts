// Comments domain: the local review store (report 04 §4.3) — threads,
// comments and per-file viewed state for the currently targeted PR.
// Delegates to store/review.ts; the `gh` calls here only resolve the bits
// (PR node id, current head, viewer login) the local store needs to stamp
// a brand-new draft (report 01 §7 `DraftAnchor`, `LocalViewedState.prId`).
import type { HandlerMap } from '../registry'
import * as gh from '../../services/gh'
import * as review from '../../store/review'

export const commentsHandlers: Pick<
  HandlerMap,
  'comments.list' | 'comments.upsert' | 'comments.delete' | 'viewed.list' | 'viewed.set'
> = {
  'comments.list': ({ projectId, pr }) => review.listThreads(projectId, pr),

  /** New thread / reply / edit, per `CommentDraft`'s doc comment:
   * - `id` set            -> edit that local draft's body/references
   * - `id` null + `threadId` -> reply in that thread
   * - `id` null + `threadId` null + `anchor` -> new thread
   * A new thread needs the PR's node id and current head to anchor it
   * ("Main fills original* and commitOid (current PR head) when storing");
   * any new local comment (thread or reply) needs the viewer's login to
   * author it before Sync has a real GitHub identity for it. */
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

  /** Local-only, high-frequency (Enter-key) toggle — needs the PR's node id
   * (report 01 §4: `LocalViewedState.prId`) but must not hit the network on
   * every keystroke, so it reuses one already known from a prior viewed row
   * or synced thread and only calls `gh pr view` the first time. */
  'viewed.set': async ({ projectId, pr, paths, viewed }) => {
    let prId = await review.knownPrId(projectId, pr)
    if (!prId) {
      const { owner, repo } = await gh.repoRefFor(projectId)
      prId = (await gh.viewPr(owner, repo, pr)).id
    }
    return review.setLocalViewed(projectId, pr, prId, paths, viewed)
  }
}
