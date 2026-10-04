import { z } from 'zod';

// GitHub's GraphQL node ids are prefixed by type: "PR_…", "PRRT_…", "PRRC_…", "PRR_…".
export const NodeId = z.string().min(1);
export const Sha = z.string().regex(/^[0-9a-f]{40}$/);
// GitHub's API emits timestamps as ISO 8601 UTC with a "Z" suffix.
export const IsoDate = z.iso.datetime({ offset: true });
export const Login = z.string().min(1);

export const Actor = z.object({
  login: Login,
  name: z.string().nullable().optional(),
});
export type Actor = z.infer<typeof Actor>;

export const DiffSide = z.enum(['LEFT', 'RIGHT']);
export type DiffSide = z.infer<typeof DiffSide>;
export const ChangeType = z.enum(['ADDED', 'DELETED', 'RENAMED', 'COPIED', 'MODIFIED', 'CHANGED']);
export type ChangeType = z.infer<typeof ChangeType>;
export const ViewedState = z.enum(['UNVIEWED', 'VIEWED', 'DISMISSED']);
export type ViewedState = z.infer<typeof ViewedState>;
export const ReviewState = z.enum([
  'PENDING',
  'COMMENTED',
  'APPROVED',
  'CHANGES_REQUESTED',
  'DISMISSED',
]);
export type ReviewState = z.infer<typeof ReviewState>;
// 'PR' is not a GitHub subject type: it marks a general PR-level comment
// (an IssueComment), which has no file/line anchor at all.
export const SubjectType = z.enum(['LINE', 'FILE', 'PR']);
export type SubjectType = z.infer<typeof SubjectType>;

export const SyncMode = z.enum(['full', 'pull']);
export type SyncMode = z.infer<typeof SyncMode>;

export const RepoPath = z.string().regex(/^(?!\/)(?!.*\\)(?!.*(^|\/)\.\.(\/|$)).+/);

export const PrListItem = z.object({
  number: z.int().positive(),
  // GitHub mutations require the GraphQL node id, not the PR number.
  id: NodeId,
  title: z.string(),
  author: z.object({
    login: Login,
    name: z.string().nullable().optional(),
    is_bot: z.boolean().optional(),
  }),
  headRefName: z.string(),
  baseRefName: z.string(),
  headRefOid: Sha,
  createdAt: IsoDate,
  changedFiles: z.int().nonnegative(),
  labels: z.array(z.object({ name: z.string(), color: z.string() })),
  url: z.url(),
});
export type PrListItem = z.infer<typeof PrListItem>;

export const PrSummary = PrListItem.extend({
  baseRefOid: Sha,
});
export type PrSummary = z.infer<typeof PrSummary>;

export const ChangedFile = z.object({
  path: z.string(),
  // GitHub's GraphQL PR files omit a renamed file's previous path.
  previousPath: z.string().nullable().default(null),
  changeType: ChangeType,
  additions: z.int().nonnegative(),
  deletions: z.int().nonnegative(),
});
export type ChangedFile = z.infer<typeof ChangedFile>;

export const Commit = z.object({
  oid: Sha,
  messageHeadline: z.string(),
  messageBody: z.string(),
  authoredDate: IsoDate,
  committedDate: IsoDate,
  authors: z.array(z.object({ login: Login.nullable(), name: z.string(), email: z.string() })),
});
export type Commit = z.infer<typeof Commit>;

export const TargetRef = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('pr'), pr: z.int().positive() }),
  z.object({ kind: z.literal('commit'), sha: Sha }),
  z.object({ kind: z.literal('default') }),
]);
export type TargetRef = z.infer<typeof TargetRef>;

export const PersistedTargeting = z.object({
  pr: z.int().positive().nullable(),
  commit: Sha.nullable(),
  path: RepoPath.nullable(),
});
export type PersistedTargeting = z.infer<typeof PersistedTargeting>;

export const IssueRef = z.object({ number: z.int().positive(), url: z.string() });
export type IssueRef = z.infer<typeof IssueRef>;

export const CheckoutResult = z.object({ base: Sha, head: Sha });
export type CheckoutResult = z.infer<typeof CheckoutResult>;

export const ImageData = z.object({ mime: z.string(), base64: z.string() });
export type ImageData = z.infer<typeof ImageData>;

export const FileContent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), path: RepoPath, sha: Sha, text: z.string() }),
  z.object({ kind: z.literal('image'), path: RepoPath, sha: Sha, image: ImageData }),
  z.object({ kind: z.literal('binary'), path: RepoPath, sha: Sha }),
  z.object({ kind: z.literal('missing'), path: RepoPath, sha: Sha }),
]);
export type FileContent = z.infer<typeof FileContent>;

// GitHub anchors review comments on added and context lines to RIGHT/newLine
// and on deleted lines to LEFT/oldLine.
export const DiffRowKind = z.enum(['context', 'add', 'delete', 'hunk']);
export type DiffRowKind = z.infer<typeof DiffRowKind>;
export const DiffRow = z.object({
  kind: DiffRowKind,
  oldLine: z.int().positive().nullable(),
  newLine: z.int().positive().nullable(),
  text: z.string(),
});
export type DiffRow = z.infer<typeof DiffRow>;

export const FileDiff = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    path: RepoPath,
    previousPath: RepoPath.nullable(),
    rows: z.array(DiffRow),
  }),
  z.object({
    kind: z.literal('image'),
    path: RepoPath,
    previousPath: RepoPath.nullable(),
    before: ImageData.nullable(),
    after: ImageData.nullable(),
  }),
  z.object({ kind: z.literal('binary'), path: RepoPath, previousPath: RepoPath.nullable() }),
  z.object({ kind: z.literal('missing'), path: RepoPath }),
]);
export type FileDiff = z.infer<typeof FileDiff>;
