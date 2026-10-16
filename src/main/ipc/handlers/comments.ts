import { AppError } from '@gepard/common';
import type { HandlerMap } from '../dispatch';
import type { GitService } from '../../services/git';
import type { ReviewStore, UpsertContext } from '../../store/review';
import { UNASSIGNED_PR_ID } from '../../store/review';

export class CommentsHandlers {
  constructor(
    private readonly git: GitService,
    private readonly review: ReviewStore,
  ) {}

  private async resolvePrId(
    projectId: string,
    pr: number,
    requested: string | null,
  ): Promise<string> {
    const prId = requested ?? (await this.review.knownPrId(projectId, pr));
    if (!prId) {
      throw new AppError(
        'BAD_INPUT',
        `no known PR node id for ${projectId}#${pr}; open this PR online at least once first`,
      );
    }
    return prId;
  }

  toHandlerMap(): Pick<
    HandlerMap,
    'comments.list' | 'comments.upsert' | 'comments.delete' | 'viewed.list' | 'viewed.set'
  > {
    return {
      'comments.list': ({ projectId, pr }) => this.review.listThreads(projectId, pr),

      'comments.upsert': async (draft) => {
        const { projectId, pr, id, threadId, anchor, general, body, references, prId } = draft;
        const isNewThread = id === null && threadId === null && (anchor !== null || general);

        let ctx: UpsertContext = { prId: '', commitOid: '' };
        if (isNewThread) {
          const resolvedPrId =
            pr === null ? UNASSIGNED_PR_ID : await this.resolvePrId(projectId, pr, prId);
          const commitOid = anchor !== null ? (await this.git.workingTree(projectId)).head : '';
          ctx = { prId: resolvedPrId, commitOid };
        }

        return this.review.upsertLocalComment(projectId, pr, ctx, {
          id,
          threadId,
          anchor,
          general,
          body,
          references,
        });
      },

      'comments.delete': ({ projectId, pr, commentId }) =>
        this.review.deleteLocalComment(projectId, pr, commentId),

      'viewed.list': ({ projectId, pr }) => this.review.listViewed(projectId, pr),

      'viewed.set': async ({ projectId, pr, paths, viewed, prId, sha }) => {
        const resolvedPrId = await this.resolvePrId(projectId, pr, prId);
        return this.review.setLocalViewed(projectId, pr, resolvedPrId, paths, viewed, sha);
      },
    };
  }
}
