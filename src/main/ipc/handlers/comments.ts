import { AppError } from '@gepard/common';
import type { HandlerMap } from '../registry';
import type { GitService } from '../../services/git';
import * as review from '../../store/review';

async function resolvePrId(
  projectId: string,
  pr: number,
  requested: string | null,
): Promise<string> {
  const prId = requested ?? (await review.knownPrId(projectId, pr));
  if (!prId) {
    throw new AppError(
      'BAD_INPUT',
      `no known PR node id for ${projectId}#${pr}; open this PR online at least once first`,
    );
  }
  return prId;
}

export function createCommentsHandlers(
  git: GitService,
): Pick<
  HandlerMap,
  'comments.list' | 'comments.upsert' | 'comments.delete' | 'viewed.list' | 'viewed.set'
> {
  return {
    'comments.list': ({ projectId, pr }) => review.listThreads(projectId, pr),

    'comments.upsert': async (draft) => {
      const { projectId, pr, id, threadId, anchor, general, body, references, prId } = draft;
      const isNewThread = id === null && threadId === null && (anchor !== null || general);

      let ctx: review.UpsertContext = { prId: '', commitOid: '' };
      if (isNewThread) {
        const resolvedPrId = await resolvePrId(projectId, pr, prId);
        const commitOid = anchor !== null ? (await git.workingTree(projectId)).head : '';
        ctx = { prId: resolvedPrId, commitOid };
      }

      return review.upsertLocalComment(projectId, pr, ctx, {
        id,
        threadId,
        anchor,
        general,
        body,
        references,
      });
    },

    'comments.delete': ({ projectId, pr, commentId }) =>
      review.deleteLocalComment(projectId, pr, commentId),

    'viewed.list': ({ projectId, pr }) => review.listViewed(projectId, pr),

    'viewed.set': async ({ projectId, pr, paths, viewed, prId }) => {
      const resolvedPrId = await resolvePrId(projectId, pr, prId);
      return review.setLocalViewed(projectId, pr, resolvedPrId, paths, viewed);
    },
  };
}
