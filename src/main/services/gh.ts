// `gh` CLI calls (report 01), spawned through services/exec.ts's run/runJson.
// Every spawn uses gh's own environment tweaks (report 04 §3.2) and a
// timeout (services/exec.ts's `timeoutMs`); GraphQL pagination is our own
// cursor loop, never `gh api --paginate` (report 01 §6: a cursor variable
// not named exactly `$endCursor` makes `--paginate` hang forever).
import { z } from 'zod'
import { runJson, ExecError } from './exec'
import { AppError } from '../ipc/registry'
import { getProject } from '../store/projects'
import {
  NodeId,
  Sha,
  DiffSide,
  IsoDate,
  ReviewState,
  PrListItem,
  PrSummary,
  Commit,
  Login
} from '@shared/ipc/schemas/pr'
import {
  GqlError,
  GqlPageInfo,
  GqlReviewCommentRaw,
  GqlReviewThreadRaw,
  GqlReviewThreadsPage,
  RemoteViewedFile
} from '@shared/ipc/schemas/comment'
import type { Viewer } from '@shared/ipc/schemas/project'

// ---------------------------------------------------------------------------
// Spawning `gh` (report 04 §3.2)
// ---------------------------------------------------------------------------

const GH_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GH_PROMPT_DISABLED: '1',
  GH_NO_UPDATE_NOTIFIER: '1',
  GH_PAGER: 'cat',
  NO_COLOR: '1',
  CLICOLOR: '0'
}

/** Every `gh` spawn has a timeout (report 01 §6, report 04 §3.1). */
const DEFAULT_TIMEOUT_MS = 30_000

function ghOpts(extra: { stdin?: string } = {}): {
  env: NodeJS.ProcessEnv
  timeoutMs: number
  stdin?: string
} {
  return { timeoutMs: DEFAULT_TIMEOUT_MS, env: GH_ENV, ...extra }
}

export interface RepoRef {
  owner: string
  repo: string
}

/** Resolves a project id to the `owner/repo` gh needs for `-R`. */
export async function repoRefFor(projectId: string): Promise<RepoRef> {
  const project = await getProject(projectId)
  if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`)
  return { owner: project.owner, repo: project.repo }
}

// ---------------------------------------------------------------------------
// 1. Listing PRs and PR summary (report 01 §1)
// ---------------------------------------------------------------------------

const PR_LIST_FIELDS =
  'number,title,state,isDraft,author,headRefName,baseRefName,headRefOid,updatedAt,createdAt,changedFiles,labels,reviewDecision,url'

/** `gh pr list` for the fuzzy-search combo box (report 01 §1.2): open PRs by
 * default, narrowed server-side with `--search` once the user types. */
export async function listPrs(owner: string, repo: string, search?: string): Promise<PrListItem[]> {
  const args = ['pr', 'list', '-R', `${owner}/${repo}`, '--limit', '100', '--json', PR_LIST_FIELDS]
  if (search) args.push('--search', search)
  return runJson(z.array(PrListItem), 'gh', args, ghOpts())
}

const PR_SUMMARY_FIELDS = [
  'number',
  'title',
  'state',
  'isDraft',
  'author',
  'baseRefName',
  'baseRefOid',
  'headRefName',
  'headRefOid',
  'changedFiles',
  'additions',
  'deletions',
  'createdAt',
  'updatedAt',
  'mergedAt',
  'url',
  'id',
  'reviewDecision',
  'labels',
  'mergeCommit'
].join(',')

/** `gh pr view` summary (report 01 §1.3); `files`/`commits` are deliberately
 * not requested here — files come from local git (report 01 §2.2), commits
 * from `viewPrCommits` below. */
export async function viewPr(owner: string, repo: string, number: number): Promise<PrSummary> {
  return runJson(
    PrSummary,
    'gh',
    ['pr', 'view', String(number), '-R', `${owner}/${repo}`, '--json', PR_SUMMARY_FIELDS],
    ghOpts()
  )
}

const PrCommitsResponse = z.object({ commits: z.array(Commit) })

/** Commit list of a PR (report 01 §2.1), topological order, oldest first. */
export async function viewPrCommits(
  owner: string,
  repo: string,
  number: number
): Promise<Commit[]> {
  const { commits } = await runJson(
    PrCommitsResponse,
    'gh',
    ['pr', 'view', String(number), '-R', `${owner}/${repo}`, '--json', 'commits'],
    ghOpts()
  )
  return commits
}

const PrHeadBase = z.object({ headRefOid: Sha, baseRefOid: Sha })

/** For `pr.checkout` with `kind: 'pr'`: fetch the current head/base before
 * handing off to `checkoutTarget` (git.ts). */
export async function viewPrHeadBase(
  owner: string,
  repo: string,
  number: number
): Promise<{ headRefOid: string; baseRefOid: string }> {
  return runJson(
    PrHeadBase,
    'gh',
    ['pr', 'view', String(number), '-R', `${owner}/${repo}`, '--json', 'headRefOid,baseRefOid'],
    ghOpts()
  )
}

// ---------------------------------------------------------------------------
// Signed-in profile (report 04 §3.3)
// ---------------------------------------------------------------------------

// `gh auth status --json` always exits 0; failure is inside the JSON as
// `state !== 'success'`.
const GhAuthStatus = z.object({
  hosts: z.record(
    z.string(),
    z.array(z.object({ login: z.string(), active: z.boolean(), state: z.string() }))
  )
})
const GhUser = z.object({
  login: Login,
  name: z.string().nullable(),
  avatar_url: z.url(),
  html_url: z.url()
})

async function fetchUser(): Promise<z.infer<typeof GhUser>> {
  return runJson(GhUser, 'gh', ['api', 'user'], ghOpts())
}

/** The launchpad prefill: the signed-in `gh` profile, or null when `gh` has
 * no active signed-in account. */
export async function viewer(): Promise<Viewer | null> {
  const status = await runJson(
    GhAuthStatus,
    'gh',
    ['auth', 'status', '--active', '--json', 'hosts'],
    ghOpts()
  )
  const active = Object.values(status.hosts)
    .flat()
    .find((h) => h.active && h.state === 'success')
  if (!active) return null
  const user = await fetchUser()
  return { login: user.login, name: user.name, avatarUrl: user.avatar_url, htmlUrl: user.html_url }
}

let cachedViewerLogin: string | null = null

/** The signed-in `gh` login, cached for the process lifetime. Used to author
 * local (not-yet-synced) comment drafts before Sync gives them a real GitHub
 * identity. */
export async function currentUserLogin(): Promise<string> {
  if (cachedViewerLogin) return cachedViewerLogin
  const { login } = await fetchUser()
  cachedViewerLogin = login
  return login
}

// ---------------------------------------------------------------------------
// GraphQL plumbing (report 01 §3.2, §6)
// ---------------------------------------------------------------------------

function checkGqlErrors(errors: GqlError[] | undefined): void {
  if (errors && errors.length > 0) {
    throw new AppError('GRAPHQL_ERROR', errors.map((e) => e.message).join('; '), errors)
  }
}

/** `gh api graphql --input -` with a typed `{query, variables}` document fed
 * over stdin (report 01 §3.2/§4/§6: avoids shell quoting and argv limits).
 * A non-zero exit — including a GraphQL partial error, whose stdout still
 * carries `data`+`errors` (report 01 §6) — is already a thrown `ExecError`
 * from `runJson` before we ever see the body, which is the app's chosen
 * behaviour ("treat exit ≠ 0 as error even if stdout contains data", §0).
 * The `errors` check below is defensive for the exit-0-with-errors case. */
async function graphql<T extends { errors?: GqlError[] }>(
  schema: z.ZodType<T>,
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const result = await runJson(schema, 'gh', ['api', 'graphql', '--input', '-'], {
    ...ghOpts(),
    stdin: JSON.stringify({ query, variables })
  })
  checkGqlErrors(result.errors)
  return result
}

const REVIEW_COMMENT_FIELDS = `
  id databaseId url
  author { login }
  body createdAt updatedAt lastEditedAt
  path line originalLine startLine originalStartLine
  diffHunk outdated state
  commit { oid } originalCommit { oid }
  replyTo { id databaseId }
  pullRequestReview { id databaseId state }
  viewerDidAuthor viewerCanDelete
`

// ---------------------------------------------------------------------------
// 3. Review threads (report 01 §3.2) — own cursor loop for both the outer
// `reviewThreads` connection and each thread's nested `comments` connection.
// ---------------------------------------------------------------------------

const REVIEW_THREADS_QUERY = `
query($owner:String!, $name:String!, $number:Int!, $endCursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      id number headRefOid baseRefOid
      reviewThreads(first:50, after:$endCursor) {
        totalCount
        pageInfo { hasNextPage endCursor }
        nodes {
          id isResolved isOutdated
          path line originalLine startLine originalStartLine
          diffSide startDiffSide subjectType
          comments(first:50) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes { ${REVIEW_COMMENT_FIELDS} }
          }
        }
      }
    }
  }
}`

const ThreadCommentsPage = z.object({
  data: z.object({
    node: z
      .object({
        comments: z.object({ pageInfo: GqlPageInfo, nodes: z.array(GqlReviewCommentRaw) })
      })
      .nullable()
  }),
  errors: z.array(GqlError).optional()
})

const THREAD_COMMENTS_QUERY = `
query($threadId:ID!, $endCursor:String) {
  node(id:$threadId) {
    ... on PullRequestReviewThread {
      comments(first:50, after:$endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { ${REVIEW_COMMENT_FIELDS} }
      }
    }
  }
}`

async function fetchRemainingThreadComments(
  threadId: string,
  after: string | null
): Promise<GqlReviewCommentRaw[]> {
  const out: GqlReviewCommentRaw[] = []
  let cursor = after
  for (;;) {
    const page = await graphql(ThreadCommentsPage, THREAD_COMMENTS_QUERY, {
      threadId,
      endCursor: cursor
    })
    const comments = page.data.node?.comments
    if (!comments) break
    out.push(...comments.nodes)
    if (!comments.pageInfo.hasNextPage) break
    cursor = comments.pageInfo.endCursor
  }
  return out
}

export interface ReviewThreadsResult {
  prId: string
  headRefOid: string
  baseRefOid: string
  threads: GqlReviewThreadRaw[]
}

/** All review threads of a PR, fully paginated (outer + nested). */
export async function fetchReviewThreads(
  owner: string,
  repo: string,
  number: number
): Promise<ReviewThreadsResult> {
  const threads: GqlReviewThreadRaw[] = []
  let prId = ''
  let headRefOid = ''
  let baseRefOid = ''
  let cursor: string | null = null
  for (;;) {
    const page = await graphql(GqlReviewThreadsPage, REVIEW_THREADS_QUERY, {
      owner,
      name: repo,
      number,
      endCursor: cursor
    })
    const pr = page.data.repository.pullRequest
    prId = pr.id
    headRefOid = pr.headRefOid
    baseRefOid = pr.baseRefOid
    for (const thread of pr.reviewThreads.nodes) {
      if (thread.comments.pageInfo.hasNextPage) {
        const rest = await fetchRemainingThreadComments(
          thread.id,
          thread.comments.pageInfo.endCursor
        )
        thread.comments.nodes.push(...rest)
      }
      threads.push(thread)
    }
    if (!pr.reviewThreads.pageInfo.hasNextPage) break
    cursor = pr.reviewThreads.pageInfo.endCursor
  }
  return { prId, headRefOid, baseRefOid, threads }
}

// ---------------------------------------------------------------------------
// 4. Viewed state of files (report 01 §4)
// ---------------------------------------------------------------------------

const FilesViewedPage = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        id: NodeId,
        headRefOid: Sha,
        changedFiles: z.number(),
        files: z.object({
          totalCount: z.number(),
          pageInfo: GqlPageInfo,
          nodes: z.array(RemoteViewedFile)
        })
      })
    })
  }),
  errors: z.array(GqlError).optional()
})

const FILES_VIEWED_QUERY = `
query($owner:String!, $name:String!, $number:Int!, $endCursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      id headRefOid changedFiles
      files(first:100, after:$endCursor) {
        totalCount pageInfo { hasNextPage endCursor }
        nodes { path additions deletions changeType viewerViewedState }
      }
    }
  }
}`

export interface FilesViewedResult {
  prId: string
  headRefOid: string
  files: RemoteViewedFile[]
}

/** All files' viewed state for a PR, fully paginated. */
export async function fetchViewedFiles(
  owner: string,
  repo: string,
  number: number
): Promise<FilesViewedResult> {
  const files: RemoteViewedFile[] = []
  let prId = ''
  let headRefOid = ''
  let cursor: string | null = null
  for (;;) {
    const page = await graphql(FilesViewedPage, FILES_VIEWED_QUERY, {
      owner,
      name: repo,
      number,
      endCursor: cursor
    })
    const pr = page.data.repository.pullRequest
    prId = pr.id
    headRefOid = pr.headRefOid
    files.push(...pr.files.nodes)
    if (!pr.files.pageInfo.hasNextPage) break
    cursor = pr.files.pageInfo.endCursor
  }
  return { prId, headRefOid, files }
}

const BatchMutationResponse = z.object({
  data: z.unknown().nullable().optional(),
  errors: z.array(GqlError).optional()
})

export interface ViewedChange {
  path: string
  viewed: boolean
}

/** One aliased mutation for every changed file (report 01 §4: "Batching: one
 * request with aliases"). */
export async function setFilesViewed(
  pullRequestId: string,
  changes: ViewedChange[]
): Promise<void> {
  if (changes.length === 0) return
  const varDecls = ['$pr:ID!']
  const fields: string[] = []
  const variables: Record<string, unknown> = { pr: pullRequestId }
  changes.forEach((c, i) => {
    const pathVar = `p${i}`
    varDecls.push(`$${pathVar}:String!`)
    variables[pathVar] = c.path
    const mutation = c.viewed ? 'markFileAsViewed' : 'unmarkFileAsViewed'
    fields.push(
      `f${i}: ${mutation}(input:{pullRequestId:$pr, path:$${pathVar}}) { clientMutationId }`
    )
  })
  const query = `mutation(${varDecls.join(', ')}) {\n${fields.join('\n')}\n}`
  await graphql(BatchMutationResponse, query, variables)
}

// ---------------------------------------------------------------------------
// 5/8. Creating comments — pending review reuse, new thread (LINE→FILE
// fallback), replies, delete, submit (report 01 §5, §8).
// ---------------------------------------------------------------------------

const PendingReviewResponse = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        reviews: z.object({
          nodes: z.array(z.object({ id: NodeId, commit: z.object({ oid: Sha }).nullable() }))
        })
      })
    })
  }),
  errors: z.array(GqlError).optional()
})

const PENDING_REVIEW_QUERY = `
query($owner:String!, $name:String!, $number:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      reviews(first:1, states:[PENDING]) { nodes { id commit { oid } } }
    }
  }
}`

/** The viewer's own pending review, if any (only the viewer's is visible). */
export async function findPendingReview(
  owner: string,
  repo: string,
  number: number
): Promise<{ id: string } | null> {
  const page = await graphql(PendingReviewResponse, PENDING_REVIEW_QUERY, {
    owner,
    name: repo,
    number
  })
  const node = page.data.repository.pullRequest.reviews.nodes[0]
  return node ? { id: node.id } : null
}

const CreateReviewResponse = z.object({
  data: z.object({
    addPullRequestReview: z.object({ pullRequestReview: z.object({ id: NodeId }) })
  }),
  errors: z.array(GqlError).optional()
})

const CREATE_REVIEW_QUERY = `
mutation($pr:ID!, $oid:GitObjectID!) {
  addPullRequestReview(input:{ pullRequestId:$pr, commitOID:$oid, body:"" }) {
    pullRequestReview { id }
  }
}`

async function createPendingReview(pullRequestId: string, commitOid: string): Promise<string> {
  const res = await graphql(CreateReviewResponse, CREATE_REVIEW_QUERY, {
    pr: pullRequestId,
    oid: commitOid
  })
  return res.data.addPullRequestReview.pullRequestReview.id
}

/** "One pending review per user per PR" (report 01 §8): reuse the viewer's
 * pending review if one exists, else create one pinned to `headRefOid`. */
export async function ensurePendingReview(
  owner: string,
  repo: string,
  number: number,
  pullRequestId: string,
  headRefOid: string
): Promise<string> {
  const existing = await findPendingReview(owner, repo, number)
  if (existing) return existing.id
  return createPendingReview(pullRequestId, headRefOid)
}

const NewThreadComment = z.object({
  id: NodeId,
  databaseId: z.number().nullable(),
  createdAt: IsoDate,
  updatedAt: IsoDate,
  url: z.string(),
  pullRequestReview: z.object({ id: NodeId, state: ReviewState }).nullable()
})

const AddThreadResponse = z.object({
  data: z.object({
    addPullRequestReviewThread: z
      .object({
        thread: z.object({
          id: NodeId,
          isResolved: z.boolean(),
          path: z.string(),
          line: z.number().nullable(),
          startLine: z.number().nullable(),
          diffSide: DiffSide,
          comments: z.object({ nodes: z.array(NewThreadComment) })
        })
      })
      .nullable()
  }),
  errors: z.array(GqlError).optional()
})

const ADD_THREAD_LINE_QUERY = `
mutation($reviewId:ID!, $path:String!, $body:String!, $line:Int!, $side:DiffSide!, $startLine:Int, $startSide:DiffSide, $subjectType:PullRequestReviewThreadSubjectType!) {
  addPullRequestReviewThread(input:{ pullRequestReviewId:$reviewId, path:$path, body:$body, line:$line, side:$side, startLine:$startLine, startSide:$startSide, subjectType:$subjectType }) {
    thread { id isResolved path line startLine diffSide
      comments(first:1){ nodes { id databaseId createdAt updatedAt url pullRequestReview { id state } } } }
  }
}`

const ADD_THREAD_FILE_QUERY = `
mutation($reviewId:ID!, $path:String!, $body:String!) {
  addPullRequestReviewThread(input:{ pullRequestReviewId:$reviewId, path:$path, body:$body, subjectType:FILE }) {
    thread { id isResolved path line startLine diffSide
      comments(first:1){ nodes { id databaseId createdAt updatedAt url pullRequestReview { id state } } } }
  }
}`

export interface NewThreadInput {
  pullRequestReviewId: string
  path: string
  body: string
  line: number | null
  side: 'LEFT' | 'RIGHT'
  startLine?: number | null
  startSide?: 'LEFT' | 'RIGHT' | null
}

export interface NewThreadResult {
  thread: {
    id: string
    isResolved: boolean
    path: string
    line: number | null
    startLine: number | null
    diffSide: 'LEFT' | 'RIGHT'
  }
  rootComment: z.infer<typeof NewThreadComment>
  /** true when this was pushed (or fell back) as a FILE thread. */
  isFile: boolean
}

function isLineNotInDiffError(e: unknown): boolean {
  return e instanceof ExecError && /must be part of the diff/i.test(e.stderr)
}

type AddThreadResponseType = z.infer<typeof AddThreadResponse>
type ThreadPayload = NonNullable<
  AddThreadResponseType['data']['addPullRequestReviewThread']
>['thread']

function firstComment(res: AddThreadResponseType): {
  thread: ThreadPayload
  root: z.infer<typeof NewThreadComment>
} {
  const thread = res.data.addPullRequestReviewThread?.thread
  if (!thread) throw new AppError('GRAPHQL_ERROR', 'addPullRequestReviewThread returned no thread')
  const root = thread.comments.nodes[0]
  if (!root)
    throw new AppError('GRAPHQL_ERROR', 'addPullRequestReviewThread returned no root comment')
  return { thread, root }
}

async function addThreadAsFile(
  pullRequestReviewId: string,
  path: string,
  body: string
): Promise<NewThreadResult> {
  const res = await graphql(AddThreadResponse, ADD_THREAD_FILE_QUERY, {
    reviewId: pullRequestReviewId,
    path,
    body
  })
  const { thread, root } = firstComment(res)
  return { thread, rootComment: root, isFile: true }
}

/** LINE first; on the 422 "must be part of the diff" (report 01 §5/§8),
 * retry as a FILE thread with the original `path:line` prepended to the
 * body as the first reference line. A caller-chosen FILE thread (`line:
 * null`, the editor's file-level comment) skips the LINE attempt. */
export async function addReviewThread(input: NewThreadInput): Promise<NewThreadResult> {
  if (input.line === null) return addThreadAsFile(input.pullRequestReviewId, input.path, input.body)
  const line = input.line
  try {
    const res = await graphql(AddThreadResponse, ADD_THREAD_LINE_QUERY, {
      reviewId: input.pullRequestReviewId,
      path: input.path,
      body: input.body,
      line,
      side: input.side,
      startLine: input.startLine ?? null,
      startSide: input.startSide ?? null,
      subjectType: 'LINE'
    })
    const { thread, root } = firstComment(res)
    return { thread, rootComment: root, isFile: false }
  } catch (e) {
    if (!isLineNotInDiffError(e)) throw e
    const fallbackBody = `${input.path}:${line}\n\n${input.body}`
    return addThreadAsFile(input.pullRequestReviewId, input.path, fallbackBody)
  }
}

const ReplyComment = NewThreadComment.extend({ replyTo: z.object({ id: NodeId }).nullable() })

const AddReplyResponse = z.object({
  data: z.object({ addPullRequestReviewThreadReply: z.object({ comment: ReplyComment }) }),
  errors: z.array(GqlError).optional()
})

const ADD_REPLY_QUERY = `
mutation($threadId:ID!, $body:String!, $reviewId:ID) {
  addPullRequestReviewThreadReply(input:{ pullRequestReviewThreadId:$threadId, body:$body, pullRequestReviewId:$reviewId }) {
    comment { id databaseId createdAt updatedAt url replyTo { id } pullRequestReview { id state } }
  }
}`

/** Only the thread root can be replied to (GitHub always points replies at
 * the root, report 01 §3.1). */
export async function addReviewThreadReply(
  threadId: string,
  body: string,
  reviewId?: string | null
): Promise<z.infer<typeof ReplyComment>> {
  const res = await graphql(AddReplyResponse, ADD_REPLY_QUERY, {
    threadId,
    body,
    reviewId: reviewId ?? null
  })
  return res.data.addPullRequestReviewThreadReply.comment
}

const DeleteCommentResponse = z.object({
  data: z.object({
    deletePullRequestReviewComment: z
      .object({ pullRequestReview: z.object({ id: NodeId }).nullable() })
      .nullable()
  }),
  errors: z.array(GqlError).optional()
})

const DELETE_COMMENT_QUERY = `
mutation($id:ID!) {
  deletePullRequestReviewComment(input:{id:$id}) { pullRequestReview { id } }
}`

export async function deleteReviewComment(commentId: string): Promise<void> {
  await graphql(DeleteCommentResponse, DELETE_COMMENT_QUERY, { id: commentId })
}

const SubmitReviewResponse = z.object({
  data: z.object({
    submitPullRequestReview: z.object({
      pullRequestReview: z.object({ id: NodeId, state: ReviewState })
    })
  }),
  errors: z.array(GqlError).optional()
})

const SUBMIT_REVIEW_QUERY = `
mutation($reviewId:ID!, $body:String) {
  submitPullRequestReview(input:{ pullRequestReviewId:$reviewId, event:COMMENT, body:$body }) {
    pullRequestReview { id state }
  }
}`

/** One review → one notification for everything staged in steps 3.x
 * (report 01 §8). */
export async function submitReview(reviewId: string, body?: string): Promise<void> {
  await graphql(SubmitReviewResponse, SUBMIT_REVIEW_QUERY, { reviewId, body: body ?? null })
}
