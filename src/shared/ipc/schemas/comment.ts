// Comment / thread / viewed-state schemas — report 01 §7 verbatim (ported to
// the zod 4.6.5 idiom decided in report 04 §1.1: z.url(), z.int(),
// z.iso.datetime(); functionally identical to the v3 syntax in the report).
//
// Raw GraphQL schemas keep report 01's `z.number()` exactly.
//
// CommentReference / DraftAnchor / CommentDraft are constructed: report 04
// §2.3 names `CommentDraft` with `references: .default([])` but not the rest.
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

// ---------- viewed state ----------
export const RemoteViewedFile = z.object({
  // GraphQL PullRequestChangedFile
  path: z.string(),
  additions: z.number(),
  deletions: z.number(),
  changeType: ChangeType,
  viewerViewedState: ViewedState
})
export type RemoteViewedFile = z.infer<typeof RemoteViewedFile>

export const LocalViewedState = z.object({
  // what we persist per (pr, path)
  prId: NodeId,
  path: z.string(),
  viewed: z.boolean(),
  remote: ViewedState.nullable(), // last known remote value
  localUpdatedAt: IsoDate.nullable(), // null => never touched locally
  remoteFetchedAt: IsoDate.nullable()
})
export type LocalViewedState = z.infer<typeof LocalViewedState>

// ---------- comment ----------
export const Comment = z.object({
  id: NodeId, // PRRC_…  (local drafts: "local:<uuid>")
  databaseId: z.int().nullable(),
  threadId: NodeId, // PRRT_… (or local thread id)
  reviewId: NodeId.nullable(), // PRR_…
  reviewState: ReviewState.nullable(), // PENDING => draft on GitHub, only viewer sees it
  author: Actor,
  body: z.string(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  lastEditedAt: IsoDate.nullable(),
  replyToId: NodeId.nullable(), // always the thread root on GitHub
  url: z.url().nullable(),
  outdated: z.boolean(),
  viewerDidAuthor: z.boolean(),
  viewerCanDelete: z.boolean(),
  // local-only bookkeeping (never sent)
  local: z
    .object({
      status: z.enum(['synced', 'new', 'deleted']),
      updatedAt: IsoDate, // local timestamp for merge
      references: z
        .array(
          z.object({
            path: z.string(),
            line: z.int(),
            kind: z.enum(['symbol', 'exact', 'pattern'])
          })
        )
        .default([]) // = CommentReference
    })
    .optional()
})
export type Comment = z.infer<typeof Comment>

// ---------- review thread ----------
export const Anchor = z.object({
  path: z.string(),
  subjectType: SubjectType,
  side: DiffSide, // side of `line`
  line: z.int().nullable(), // null: FILE thread or outdated
  startLine: z.int().nullable(),
  startSide: DiffSide.nullable(),
  originalLine: z.int().nullable(),
  originalStartLine: z.int().nullable(),
  commitOid: Sha.nullable(), // commit `line` refers to (head at last placement)
  originalCommitOid: Sha.nullable() // commit `originalLine` refers to
})
export type Anchor = z.infer<typeof Anchor>

export const ReviewThread = z.object({
  id: NodeId, // PRRT_… (local drafts: "local:<uuid>")
  prId: NodeId,
  anchor: Anchor,
  isResolved: z.boolean(),
  isOutdated: z.boolean(),
  comments: z.array(Comment).min(1), // [0] is the root, sorted by createdAt
  remoteUpdatedAt: IsoDate, // max(comments.updatedAt) as seen remotely
  local: z
    .object({
      status: z.enum(['synced', 'new', 'deleted']),
      updatedAt: IsoDate
    })
    .optional()
})
export type ReviewThread = z.infer<typeof ReviewThread>

// ---------- raw GraphQL boundary (validate before mapping) ----------
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
  author: z.object({ login: z.string().min(1) }).nullable(), // null for deleted users
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

// ---------- comment draft (constructed; see file header) ----------
// Same shape as report 01 §7 `Comment.local.references[]`.
export const CommentReference = z.object({
  path: z.string(),
  line: z.int(),
  kind: z.enum(['symbol', 'exact', 'pattern'])
})
export type CommentReference = z.infer<typeof CommentReference>

/** Where a new thread goes: the subset of `Anchor` the editor knows. Main
 * fills `original*` and `commitOid` (current PR head) when storing. FILE
 * threads (spec "File comments accordion") have line/startLine null. */
export const DraftAnchor = z.object({
  path: RepoPath,
  subjectType: SubjectType,
  side: DiffSide,
  line: z.int().positive().nullable(),
  startLine: z.int().positive().nullable(),
  startSide: DiffSide.nullable()
})
export type DraftAnchor = z.infer<typeof DraftAnchor>

/** comments.upsert input. Local-only write (report 01 §8): creates a `new`
 * comment, or edits one that is still `new` locally. Sync pushes it.
 * - id null + threadId null + anchor  -> new thread
 * - id null + threadId                -> reply in that thread
 * - id set                            -> edit that local draft's body/references */
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
