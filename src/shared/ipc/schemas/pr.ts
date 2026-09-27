import { z } from 'zod'

// GitHub's GraphQL node ids are prefixed by type: "PR_…", "PRRT_…", "PRRC_…", "PRR_…".
export const NodeId = z.string().min(1)
export const Sha = z.string().regex(/^[0-9a-f]{40}$/)
// GitHub's API emits timestamps as ISO 8601 UTC with a "Z" suffix.
export const IsoDate = z.iso.datetime({ offset: true })
export const Login = z.string().min(1)

export const Actor = z.object({
  login: Login,
  id: z.string().optional(),
  name: z.string().nullable().optional(),
  isBot: z.boolean().default(false)
})
export type Actor = z.infer<typeof Actor>

export const DiffSide = z.enum(['LEFT', 'RIGHT'])
export const ChangeType = z.enum(['ADDED', 'DELETED', 'RENAMED', 'COPIED', 'MODIFIED', 'CHANGED'])
export const ViewedState = z.enum(['UNVIEWED', 'VIEWED', 'DISMISSED'])
export const PrState = z.enum(['OPEN', 'CLOSED', 'MERGED'])
export const ReviewDecision = z
  .enum(['APPROVED', 'CHANGES_REQUESTED', 'REVIEW_REQUIRED'])
  .nullable()
export const ReviewState = z.enum([
  'PENDING',
  'COMMENTED',
  'APPROVED',
  'CHANGES_REQUESTED',
  'DISMISSED'
])
export const SubjectType = z.enum(['LINE', 'FILE'])

// Repo-relative POSIX path: rejects absolute paths and `..` segments.
export const RepoPath = z.string().regex(/^(?!\/)(?!.*\\)(?!.*(^|\/)\.\.(\/|$)).+/)

// Shape of `gh pr list --json` output.
export const PrListItem = z.object({
  number: z.int().positive(),
  title: z.string(),
  state: PrState,
  isDraft: z.boolean(),
  author: z.object({
    login: Login,
    name: z.string().nullable().optional(),
    is_bot: z.boolean().optional()
  }),
  headRefName: z.string(),
  baseRefName: z.string(),
  headRefOid: Sha,
  updatedAt: IsoDate,
  createdAt: IsoDate,
  changedFiles: z.int().nonnegative(),
  labels: z.array(z.object({ name: z.string(), color: z.string() })),
  reviewDecision: z
    .string()
    .transform((s) => (s === '' ? null : s))
    .pipe(ReviewDecision),
  url: z.url()
})
export type PrListItem = z.infer<typeof PrListItem>

// Shape of `gh pr view --json` output.
export const PrSummary = PrListItem.extend({
  // GitHub mutations require the GraphQL node id, not the PR number.
  id: NodeId,
  baseRefOid: Sha,
  additions: z.int(),
  deletions: z.int(),
  mergedAt: IsoDate.nullable(),
  mergeCommit: z.object({ oid: Sha }).nullable()
})
export type PrSummary = z.infer<typeof PrSummary>

export const ChangedFile = z.object({
  path: z.string(),
  // Only git's rename detection populates this; GitHub's API doesn't provide it.
  previousPath: z.string().nullable().default(null),
  changeType: ChangeType,
  additions: z.int().nonnegative(),
  deletions: z.int().nonnegative(),
  isBinary: z.boolean().optional()
})
export type ChangedFile = z.infer<typeof ChangedFile>

export const Commit = z.object({
  oid: Sha,
  messageHeadline: z.string(),
  messageBody: z.string(),
  authoredDate: IsoDate,
  committedDate: IsoDate,
  authors: z.array(z.object({ login: Login.nullable(), name: z.string(), email: z.string() })),
  files: z.array(z.lazy(() => ChangedFile)).optional()
})
export type Commit = z.infer<typeof Commit>

export const TargetRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pr'), pr: z.int().positive() }),
  z.object({ kind: z.literal('commit'), sha: Sha }),
  z.object({ kind: z.literal('default') })
])
export type TargetRef = z.infer<typeof TargetRef>

export const PersistedTargeting = z.object({
  pr: z.int().positive().nullable(),
  commit: Sha.nullable(),
  path: RepoPath.nullable()
})
export type PersistedTargeting = z.infer<typeof PersistedTargeting>

/** For a root commit (no parent), base uses git's canonical empty-tree sha
 * 4b825dc642cb6eb9a060e54bf8d69288fbee4904 since there is no parent to diff
 * against. */
export const CheckoutResult = z.object({ base: Sha, head: Sha })
export type CheckoutResult = z.infer<typeof CheckoutResult>

export const ImageData = z.object({ mime: z.string(), base64: z.string() })
export type ImageData = z.infer<typeof ImageData>

export const FileContent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), path: RepoPath, sha: Sha, text: z.string() }),
  z.object({ kind: z.literal('image'), path: RepoPath, sha: Sha, image: ImageData }),
  z.object({ kind: z.literal('binary'), path: RepoPath, sha: Sha }),
  z.object({ kind: z.literal('missing'), path: RepoPath, sha: Sha })
])
export type FileContent = z.infer<typeof FileContent>

// Rows are computed from `git diff -U3` hunks. A row maps to GitHub's
// review-comment diff anchor as: add -> RIGHT/newLine, delete -> LEFT/oldLine,
// context -> RIGHT/newLine.
export const DiffRowKind = z.enum(['context', 'add', 'delete', 'hunk'])
export const DiffRow = z.object({
  kind: DiffRowKind,
  oldLine: z.int().positive().nullable(),
  newLine: z.int().positive().nullable(),
  text: z.string()
})
export type DiffRow = z.infer<typeof DiffRow>

export const FileDiff = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    path: RepoPath,
    previousPath: RepoPath.nullable(),
    rows: z.array(DiffRow)
  }),
  z.object({
    kind: z.literal('image'),
    path: RepoPath,
    previousPath: RepoPath.nullable(),
    before: ImageData.nullable(),
    after: ImageData.nullable()
  }),
  z.object({ kind: z.literal('binary'), path: RepoPath, previousPath: RepoPath.nullable() }),
  z.object({ kind: z.literal('missing'), path: RepoPath })
])
export type FileDiff = z.infer<typeof FileDiff>
