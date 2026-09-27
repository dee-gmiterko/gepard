// GraphQL pagination here is our own cursor loop, never `gh api --paginate`:
// `--paginate` hangs forever unless the query's cursor variable is named
// exactly `$endCursor`.
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
import type { Viewer, ViewerRepo } from '@shared/ipc/schemas/project'
import { matchesTarget } from '@shared/model/paths'

const GH_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GH_PROMPT_DISABLED: '1',
  GH_NO_UPDATE_NOTIFIER: '1',
  GH_PAGER: 'cat',
  NO_COLOR: '1',
  CLICOLOR: '0'
}

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

export async function repoRefFor(projectId: string): Promise<RepoRef> {
  const project = await getProject(projectId)
  if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`)
  return { owner: project.owner, repo: project.repo }
}

const PR_LIST_FIELDS =
  'number,title,state,isDraft,author,headRefName,baseRefName,headRefOid,updatedAt,createdAt,changedFiles,labels,reviewDecision,url'

// `gh pr list --limit N` pages its own GraphQL calls internally (100 PRs per
// request) and stops once a page comes back short of that, so a very high
// limit is effectively "no cap" while staying just as cheap when there are
// few open PRs.
const OPEN_PR_LIST_LIMIT = 10_000

export function buildPrListArgs(owner: string, repo: string, search?: string): string[] {
  const args = [
    'pr',
    'list',
    '-R',
    `${owner}/${repo}`,
    '--limit',
    String(OPEN_PR_LIST_LIMIT),
    '--json',
    PR_LIST_FIELDS
  ]
  if (search) args.push('--search', search)
  return args
}

export async function listPrs(owner: string, repo: string, search?: string): Promise<PrListItem[]> {
  return runJson(z.array(PrListItem), 'gh', buildPrListArgs(owner, repo, search), ghOpts())
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

export async function viewPr(owner: string, repo: string, number: number): Promise<PrSummary> {
  return runJson(
    PrSummary,
    'gh',
    ['pr', 'view', String(number), '-R', `${owner}/${repo}`, '--json', PR_SUMMARY_FIELDS],
    ghOpts()
  )
}

const PrCommitsResponse = z.object({ commits: z.array(Commit) })

// gh returns a PR's commits in topological order, oldest first.
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

const CommitPrRaw = z.object({ number: z.int().positive() })

// `--paginate` concatenates REST pages into one array here; `--slurp` also
// exists but is GraphQL-only.
export async function listPrsForCommit(
  owner: string,
  repo: string,
  sha: string
): Promise<number[]> {
  const items = await runJson(
    z.array(CommitPrRaw),
    'gh',
    ['api', `repos/${owner}/${repo}/commits/${sha}/pulls`, '--paginate'],
    ghOpts()
  )
  return items.map((i) => i.number)
}

const PrFilesNode = z.object({
  number: z.int().positive(),
  files: z.object({
    pageInfo: GqlPageInfo,
    nodes: z.array(z.object({ path: z.string() }))
  })
})

const PrsFilesResponse = z.object({
  data: z.object({ repository: z.record(z.string(), PrFilesNode.nullable()) }),
  errors: z.array(GqlError).optional()
})

export function buildPrsFilesQuery(numbers: number[]): {
  query: string
  variables: Record<string, unknown>
} {
  const varDecls = ['$owner:String!', '$name:String!']
  const fields: string[] = []
  const variables: Record<string, unknown> = {}
  numbers.forEach((n, i) => {
    const v = `n${i}`
    varDecls.push(`$${v}:Int!`)
    variables[v] = n
    fields.push(
      `pr${i}: pullRequest(number:$${v}) { number files(first:100) { pageInfo { hasNextPage endCursor } nodes { path } } }`
    )
  })
  const query = `query(${varDecls.join(', ')}) {\n  repository(owner:$owner, name:$name) {\n${fields.join('\n')}\n  }\n}`
  return { query, variables }
}

// A null node means the number no longer resolves to a PR (deleted or
// inaccessible), and is dropped.
export function parsePrsFilesResponse(
  repository: Record<string, z.infer<typeof PrFilesNode> | null>
): Map<number, string[]> {
  const map = new Map<number, string[]>()
  for (const node of Object.values(repository)) {
    if (node)
      map.set(
        node.number,
        node.files.nodes.map((f) => f.path)
      )
  }
  return map
}

export function parsePrsFilesPageInfo(
  repository: Record<string, z.infer<typeof PrFilesNode> | null>
): Map<number, string> {
  const map = new Map<number, string>()
  for (const node of Object.values(repository)) {
    if (node?.files.pageInfo.hasNextPage && node.files.pageInfo.endCursor) {
      map.set(node.number, node.files.pageInfo.endCursor)
    }
  }
  return map
}

const PR_FILES_PAGE_QUERY = `
query($owner:String!, $name:String!, $number:Int!, $endCursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      files(first:100, after:$endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { path }
      }
    }
  }
}`

const PrFilesPageResponse = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z
        .object({
          files: z.object({
            pageInfo: GqlPageInfo,
            nodes: z.array(z.object({ path: z.string() }))
          })
        })
        .nullable()
    })
  }),
  errors: z.array(GqlError).optional()
})

async function fetchRemainingPrFiles(
  owner: string,
  repo: string,
  number: number,
  after: string
): Promise<string[]> {
  const out: string[] = []
  let cursor: string | null = after
  for (;;) {
    const page = await graphql(PrFilesPageResponse, PR_FILES_PAGE_QUERY, {
      owner,
      name: repo,
      number,
      endCursor: cursor
    })
    const files = page.data.repository.pullRequest?.files
    if (!files) break
    out.push(...files.nodes.map((f) => f.path))
    if (!files.pageInfo.hasNextPage) break
    cursor = files.pageInfo.endCursor
  }
  return out
}

export async function fetchPrsFiles(
  owner: string,
  repo: string,
  numbers: number[]
): Promise<Map<number, string[]>> {
  if (numbers.length === 0) return new Map()
  const { query, variables } = buildPrsFilesQuery(numbers)
  const res = await graphql(PrsFilesResponse, query, { owner, name: repo, ...variables })
  const map = parsePrsFilesResponse(res.data.repository)
  const stragglers = parsePrsFilesPageInfo(res.data.repository)
  for (const [number, cursor] of stragglers) {
    const rest = await fetchRemainingPrFiles(owner, repo, number, cursor)
    map.set(number, [...(map.get(number) ?? []), ...rest])
  }
  return map
}

export function filterPrsByPath(
  prs: PrListItem[],
  filesByNumber: Map<number, string[]>,
  path: string
): PrListItem[] {
  return prs.filter((pr) =>
    (filesByNumber.get(pr.number) ?? []).some((f) => matchesTarget(f, path))
  )
}

export interface PrListFilter {
  search?: string
  commit?: string
  path?: string
}

export async function listPrsFiltered(
  owner: string,
  repo: string,
  filter: PrListFilter
): Promise<PrListItem[]> {
  let candidates: PrListItem[]
  if (filter.commit) {
    const numbers = await listPrsForCommit(owner, repo, filter.commit)
    candidates = await Promise.all(numbers.map((n) => viewPr(owner, repo, n)))
  } else {
    candidates = await listPrs(owner, repo, filter.search)
  }
  if (filter.path && candidates.length > 0) {
    const filesByNumber = await fetchPrsFiles(
      owner,
      repo,
      candidates.map((c) => c.number)
    )
    candidates = filterPrsByPath(candidates, filesByNumber, filter.path)
  }
  return candidates
}

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

async function hasActiveAuth(): Promise<boolean> {
  const status = await runJson(
    GhAuthStatus,
    'gh',
    ['auth', 'status', '--active', '--json', 'hosts'],
    ghOpts()
  )
  return Object.values(status.hosts)
    .flat()
    .some((h) => h.active && h.state === 'success')
}

export async function viewer(): Promise<Viewer | null> {
  if (!(await hasActiveAuth())) return null
  const user = await fetchUser()
  return { login: user.login, name: user.name, avatarUrl: user.avatar_url, htmlUrl: user.html_url }
}

const ViewerReposResponse = z.object({
  data: z.object({
    viewer: z.object({
      repositories: z.object({
        pageInfo: GqlPageInfo,
        nodes: z.array(
          z.object({ name: z.string(), url: z.url(), owner: z.object({ login: Login }) })
        )
      })
    })
  }),
  errors: z.array(GqlError).optional()
})

const VIEWER_REPOS_QUERY = `
query($endCursor:String) {
  viewer {
    repositories(first:50, after:$endCursor, ownerAffiliations:[OWNER, ORGANIZATION_MEMBER], orderBy:{field:UPDATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes { name url owner { login } }
    }
  }
}`

const MAX_VIEWER_REPOS = 200

export async function listViewerRepos(): Promise<ViewerRepo[]> {
  if (!(await hasActiveAuth())) return []
  const repos: ViewerRepo[] = []
  let cursor: string | null = null
  for (;;) {
    const page = await graphql(ViewerReposResponse, VIEWER_REPOS_QUERY, { endCursor: cursor })
    const { nodes, pageInfo } = page.data.viewer.repositories
    repos.push(...nodes.map((n) => ({ owner: n.owner.login, repo: n.name, url: n.url })))
    if (!pageInfo.hasNextPage || repos.length >= MAX_VIEWER_REPOS) break
    cursor = pageInfo.endCursor
  }
  return repos
}

let cachedViewerLogin: string | null = null

export async function currentUserLogin(): Promise<string> {
  if (cachedViewerLogin) return cachedViewerLogin
  const { login } = await fetchUser()
  cachedViewerLogin = login
  return login
}

function checkGqlErrors(errors: GqlError[] | undefined): void {
  if (errors && errors.length > 0) {
    throw new AppError('GRAPHQL_ERROR', errors.map((e) => e.message).join('; '), errors)
  }
}

// Fed over stdin (`--input -`) to avoid shell quoting and argv limits. A
// GraphQL partial error still returns a non-zero exit code with `errors` in
// the body, which `runJson` already throws as an `ExecError` before this
// function sees it; the check below is defensive for the rare
// exit-0-with-errors case.
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

// GitHub allows only one pending review per user per PR: reuse it if one
// exists, else create one pinned to `headRefOid`.
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

// GitHub rejects a LINE-anchored review comment with a 422 "must be part of
// the diff" error when the line isn't in the diff; this retries as a FILE
// thread with the original `path:line` prepended to the body.
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

// Only the thread root can be replied to: GitHub always points replies at
// the root.
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

export async function submitReview(reviewId: string, body?: string): Promise<void> {
  await graphql(SubmitReviewResponse, SUBMIT_REVIEW_QUERY, { reviewId, body: body ?? null })
}
