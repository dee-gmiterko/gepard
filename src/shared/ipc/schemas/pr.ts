// PR / commit / file schemas.
//
// Primitives, PrListItem, PrSummary, Commit and ChangedFile are report 01 §7
// verbatim (zod v3 syntax there; ported 1:1 to the zod 4.6.5 API used by this
// project — z.string().url() -> z.url(), z.string().datetime({offset:true})
// -> z.iso.datetime({offset:true}), z.number().int() -> z.int()).
//
// RepoPath is report 03 §7 verbatim (defined here once, re-exported from
// ./search). TargetRef, CheckoutResult, ImageData, FileContent,
// DiffRow/FileDiff are constructed (the reports decide the behaviour, not an
// IPC shape): report 02 decided the diff row model, report 04 §5.2 the
// base/head diff pair, report 04 §6 the image viewers.
import { z } from 'zod'

// ---------- primitives (report 01 §7) ----------
export const NodeId = z.string().min(1) // "PR_…", "PRRT_…", "PRRC_…", "PRR_…"
export const Sha = z.string().regex(/^[0-9a-f]{40}$/)
export const IsoDate = z.iso.datetime({ offset: true }) // GitHub emits "…Z"
export const Login = z.string().min(1)

export const Actor = z.object({
  login: Login,
  id: z.string().optional(), // node id when available
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

// repo-relative POSIX path, rejects absolute paths and `..` segments (report 03 §7)
export const RepoPath = z.string().regex(/^(?!\/)(?!.*\\)(?!.*(^|\/)\.\.(\/|$)).+/)

// ---------- PR summary (gh pr list / gh pr view) ----------
export const PrListItem = z.object({
  // what `gh pr list --json` returns for the combo box
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

export const PrSummary = PrListItem.extend({
  // `gh pr view --json …`
  id: NodeId, // GraphQL node id — required for every mutation
  baseRefOid: Sha,
  additions: z.int(),
  deletions: z.int(),
  mergedAt: IsoDate.nullable(),
  mergeCommit: z.object({ oid: Sha }).nullable()
})
export type PrSummary = z.infer<typeof PrSummary>

// ---------- commit ----------
export const ChangedFile = z.object({
  path: z.string(),
  previousPath: z.string().nullable().default(null), // renames; only git provides it
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
  // filled from local git; undefined until loaded
  files: z.array(z.lazy(() => ChangedFile)).optional()
})
export type Commit = z.infer<typeof Commit>

// ======================================================================
// Constructed shapes (not in the reports; see file header).
// ======================================================================

// ---------- targeting: what to check out (spec Behaviors: "Changing PR or
// commit checks out that version"). A commit picked while a PR is set is a
// commit of that PR and wins over the PR head. Clearing both PR and commit
// checks out the default branch head (`default`). Folder targeting never
// checks out, so it is not a member. ----------
export const TargetRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pr'), pr: z.int().positive() }),
  z.object({ kind: z.literal('commit'), sha: Sha }),
  z.object({ kind: z.literal('default') })
])
export type TargetRef = z.infer<typeof TargetRef>

/** Result of a checkout: the working tree is at `head`; `base..head` is the
 * diff pair for files.changed / files.diff (report 04 §5.2): PR target ->
 * base = merge-base(baseRefOid, headRefOid); commit target -> base = <sha>^
 * (the empty-tree sha 4b825dc642cb6eb9a060e54bf8d69288fbee4904 for a root
 * commit); default target -> base = head (nothing to diff). The renderer
 * cannot compute either, so main returns both. */
export const CheckoutResult = z.object({ base: Sha, head: Sha })
export type CheckoutResult = z.infer<typeof CheckoutResult>

// ---------- images (spec viewers: image, image diff). Bytes travel as
// base64; the renderer turns them into a blob: URL (report 04 §6). ----------
export const ImageData = z.object({ mime: z.string(), base64: z.string() })
export type ImageData = z.infer<typeof ImageData>

// ---------- file content at a sha (spec viewers: code / image / missing).
// `binary` = present but neither text nor a displayable image; `missing` =
// the path does not exist at that sha (pinned files, spec Behaviors). ----------
export const FileContent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), path: RepoPath, sha: Sha, text: z.string() }),
  z.object({ kind: z.literal('image'), path: RepoPath, sha: Sha, image: ImageData }),
  z.object({ kind: z.literal('binary'), path: RepoPath, sha: Sha }),
  z.object({ kind: z.literal('missing'), path: RepoPath, sha: Sha })
])
export type FileContent = z.infer<typeof FileContent>

// ---------- file diff rows (report 02 decision: combined single-document
// model, rows ctx/add/del with old/new line numbers, computed outside
// CodeMirror from `git diff -U3` hunks; `hunk` rows carry the @@ header).
// A row maps to a GitHub anchor as: add -> RIGHT/newLine, delete ->
// LEFT/oldLine, context -> RIGHT/newLine. ----------
export const DiffRowKind = z.enum(['context', 'add', 'delete', 'hunk'])
export const DiffRow = z.object({
  kind: DiffRowKind,
  oldLine: z.int().positive().nullable(),
  newLine: z.int().positive().nullable(),
  text: z.string()
})
export type DiffRow = z.infer<typeof DiffRow>

/** Diff of one path between base and head (spec viewers: code diff, image
 * diff, missing). `before`/`after` null = file absent on that side. */
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
