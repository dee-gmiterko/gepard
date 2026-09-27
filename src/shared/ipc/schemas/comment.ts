import { z } from 'zod'
import {
  Actor,
  ChangeType,
  DiffSide,
  NodeId,
  IsoDate,
  RepoPath,
  ReviewState,
  Sha,
  SubjectType,
  ViewedState
} from './pr'

// Matches GitHub's GraphQL PullRequestChangedFile shape.
export const RemoteViewedFile = z.object({
  path: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changeType: ChangeType,
  viewerViewedState: ViewedState
})
export type RemoteViewedFile = z.infer<typeof RemoteViewedFile>

export const LocalViewedState = z.object({
  prId: NodeId,
  path: z.string(),
  viewed: z.boolean(),
  remote: ViewedState.nullable(),
  localUpdatedAt: IsoDate.nullable(),
  remoteFetchedAt: IsoDate.nullable()
})
export type LocalViewedState = z.infer<typeof LocalViewedState>

// GitHub review comment ids start with PRRC_.
export const Comment = z.object({
  id: NodeId,
  databaseId: z.int().nullable(),
  // GitHub review thread ids start with PRRT_.
  threadId: NodeId,
  // GitHub review ids start with PRR_.
  reviewId: NodeId.nullable(),
  // PENDING means the review is a draft on GitHub, visible only to its author.
  reviewState: ReviewState.nullable(),
  author: Actor,
  body: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  lastEditedAt: IsoDate.nullable(),
  // GitHub replies always reference the thread root, not their immediate parent.
  replyToId: NodeId.nullable(),
  url: z.url().nullable(),
  outdated: z.boolean(),
  viewerDidAuthor: z.boolean(),
  viewerCanDelete: z.boolean(),
  local: z
    .object({
      status: z.enum(['synced', 'new', 'deleted']),
      updatedAt: IsoDate,
      references: z
        .array(
          z.object({
            path: z.string(),
            line: z.int(),
            kind: z.enum(['symbol', 'exact', 'pattern'])
          })
        )
        .default([])
    })
    .optional()
})
export type Comment = z.infer<typeof Comment>

export const Anchor = z.object({
  path: z.string(),
  subjectType: SubjectType,
  side: DiffSide,
  line: z.int().nullable(),
  startLine: z.int().nullable(),
  startSide: DiffSide.nullable(),
  originalLine: z.int().nullable(),
  originalStartLine: z.int().nullable(),
  commitOid: Sha.nullable(),
  originalCommitOid: Sha.nullable()
})
export type Anchor = z.infer<typeof Anchor>

// GitHub review thread ids start with PRRT_.
export const ReviewThread = z.object({
  id: NodeId,
  prId: NodeId,
  anchor: Anchor,
  isResolved: z.boolean(),
  isOutdated: z.boolean(),
  comments: z.array(Comment).min(1),
  remoteUpdatedAt: IsoDate,
  local: z
    .object({
      status: z.enum(['synced', 'new', 'deleted']),
      updatedAt: IsoDate
    })
    .optional()
})
export type ReviewThread = z.infer<typeof ReviewThread>

export const GqlPageInfo = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable()
})
export const GqlError = z.object({
  type: z.string().optional(),
  message: z.string(),
  path: z.array(z.union([z.string(), z.number()])).optional()
})
export type GqlError = z.infer<typeof GqlError>
export const GqlReviewCommentRaw = z.object({
  id: NodeId,
  databaseId: z.number().nullable(),
  url: z.string(),
  author: z.object({ login: z.string().min(1) }).nullable(), // GitHub returns null when the user account was deleted
  body: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  lastEditedAt: IsoDate.nullable(),
  path: z.string(),
  line: z.number().nullable(),
  originalLine: z.number().nullable(),
  startLine: z.number().nullable(),
  originalStartLine: z.number().nullable(),
  diffHunk: z.string(),
  outdated: z.boolean(),
  state: z.enum(['PENDING', 'SUBMITTED']),
  commit: z.object({ oid: Sha }).nullable(),
  originalCommit: z.object({ oid: Sha }).nullable(),
  replyTo: z.object({ id: NodeId }).nullable(),
  pullRequestReview: z.object({ id: NodeId, state: ReviewState }).nullable(),
  viewerDidAuthor: z.boolean(),
  viewerCanDelete: z.boolean()
})
export type GqlReviewCommentRaw = z.infer<typeof GqlReviewCommentRaw>

export const GqlReviewThreadRaw = z.object({
  id: NodeId,
  isResolved: z.boolean(),
  isOutdated: z.boolean(),
  path: z.string(),
  line: z.number().nullable(),
  originalLine: z.number().nullable(),
  startLine: z.number().nullable(),
  originalStartLine: z.number().nullable(),
  diffSide: DiffSide,
  startDiffSide: DiffSide.nullable(),
  subjectType: SubjectType,
  comments: z.object({
    totalCount: z.number(),
    pageInfo: GqlPageInfo,
    nodes: z.array(GqlReviewCommentRaw)
  })
})
export type GqlReviewThreadRaw = z.infer<typeof GqlReviewThreadRaw>

export const GqlReviewThreadsPage = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        id: NodeId,
        headRefOid: Sha,
        baseRefOid: Sha,
        reviewThreads: z.object({
          totalCount: z.number(),
          pageInfo: GqlPageInfo,
          nodes: z.array(GqlReviewThreadRaw)
        })
      })
    })
  }),
  errors: z.array(GqlError).optional()
})
export type GqlReviewThreadsPage = z.infer<typeof GqlReviewThreadsPage>

export const CommentReference = z.object({
  path: z.string(),
  line: z.int(),
  kind: z.enum(['symbol', 'exact', 'pattern'])
})
export type CommentReference = z.infer<typeof CommentReference>

export const DraftAnchor = z.object({
  path: RepoPath,
  subjectType: SubjectType,
  side: DiffSide,
  line: z.int().positive().nullable(),
  startLine: z.int().positive().nullable(),
  startSide: DiffSide.nullable()
})
export type DraftAnchor = z.infer<typeof DraftAnchor>

export const CommentDraft = z
  .object({
    projectId: z.string(),
    pr: z.int().positive(),
    id: NodeId.nullable().default(null),
    threadId: NodeId.nullable().default(null),
    anchor: DraftAnchor.nullable().default(null),
    body: z.string().min(1),
    references: z.array(CommentReference).default([])
  })
  .refine((d) => d.id !== null || d.threadId !== null || d.anchor !== null, {
    message: 'a new thread needs an anchor'
  })
export type CommentDraft = z.input<typeof CommentDraft>
