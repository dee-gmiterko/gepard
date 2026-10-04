import { z } from 'zod';
import { run, runJson } from '../helpers/process/exec';
import { chunk } from '../helpers/array';
import { mapWithConcurrency, withBatches } from '../helpers/async';
import { getProject as defaultGetProject } from '../store/projects';
import {
  buildPrListArgs,
  buildPrsFilesQuery,
  checkGqlErrors,
  filterPrsByPath,
  isLineNotInDiffError,
  matchesPrSearch,
  parseIssueCreateUrl,
  parsePrCreateUrl,
  parsePrsFilesPageInfo,
  parsePrsFilesResponse,
  PrFilesNode,
  PRS_FILES_CHUNK_SIZE,
} from '../helpers/github/ghParsing';
import {
  GhPrOverview,
  normalizePrOverview,
  parseProjectOverview,
  PR_OVERVIEW_FIELDS,
  PROJECT_OVERVIEW_QUERY,
  ProjectOverviewResponse,
} from '../helpers/github/overview';
import {
  NodeId,
  Sha,
  DiffSide,
  IsoDate,
  type IssueRef,
  ReviewState,
  PrListItem,
  PrSummary,
  Commit,
  Login,
  GqlError,
  GqlIssueCommentRaw,
  GqlPageInfo,
  GqlReviewCommentRaw,
  GqlReviewThreadRaw,
  GqlReviewThreadsPage,
  RemoteViewedFile,
  type Viewer,
  type ViewerRepo,
  AppError,
} from '@gepard/common';

const GH_ENV: NodeJS.ProcessEnv = {
  ...process.env,
  GH_PROMPT_DISABLED: '1',
  GH_NO_UPDATE_NOTIFIER: '1',
  GH_PAGER: 'cat',
  NO_COLOR: '1',
  CLICOLOR: '0',
};

const DEFAULT_TIMEOUT_MS = 30_000;
const VIEWED_MUTATION_CHUNK_SIZE = 50;

function ghOpts(extra: { stdin?: string } = {}): {
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
  stdin?: string;
} {
  return { timeoutMs: DEFAULT_TIMEOUT_MS, env: GH_ENV, ...extra };
}

export interface RepoRef {
  owner: string;
  repo: string;
}

const PR_SUMMARY_FIELDS = [
  'number',
  'title',
  'author',
  'baseRefName',
  'baseRefOid',
  'headRefName',
  'headRefOid',
  'changedFiles',
  'createdAt',
  'url',
  'id',
  'labels',
].join(',');

const PrCommitsResponse = z.object({ commits: z.array(Commit) });

const PrHeadBase = z.object({ headRefOid: Sha, baseRefOid: Sha });

export interface CreatePrInput {
  base: string;
  head: string;
  title: string;
  body: string;
}

export interface CreateIssueInput {
  title: string;
  body: string;
}

const CommitPrRaw = z.object({ number: z.int().positive() });

const PrsFilesResponse = z.object({
  data: z.object({ repository: z.record(z.string(), PrFilesNode.nullable()) }),
  errors: z.array(GqlError).optional(),
});

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
}`;

const PrFilesPageResponse = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z
        .object({
          files: z.object({
            pageInfo: GqlPageInfo,
            nodes: z.array(z.object({ path: z.string() })),
          }),
        })
        .nullable(),
    }),
  }),
  errors: z.array(GqlError).optional(),
});

export interface PrListFilter {
  search?: string;
  commit?: string;
  path?: string;
}

// `gh auth status --json` always exits 0 and reports failure as a `state`
// other than `success`.
const GhAuthStatus = z.object({
  hosts: z.record(
    z.string(),
    z.array(z.object({ login: z.string(), active: z.boolean(), state: z.string() })),
  ),
});
const GhUser = z.object({
  login: Login,
  name: z.string().nullable(),
  avatar_url: z.url(),
  html_url: z.url(),
});

const ViewerReposResponse = z.object({
  data: z.object({
    viewer: z.object({
      repositories: z.object({
        pageInfo: GqlPageInfo,
        nodes: z.array(
          z.object({ name: z.string(), url: z.url(), owner: z.object({ login: Login }) }),
        ),
      }),
    }),
  }),
  errors: z.array(GqlError).optional(),
});

const VIEWER_REPOS_QUERY = `
query($endCursor:String) {
  viewer {
    repositories(first:50, after:$endCursor, ownerAffiliations:[OWNER, ORGANIZATION_MEMBER], orderBy:{field:UPDATED_AT, direction:DESC}) {
      pageInfo { hasNextPage endCursor }
      nodes { name url owner { login } }
    }
  }
}`;

const MAX_VIEWER_REPOS = 200;

const REVIEW_COMMENT_FIELDS = `
  id
  author { login }
  body createdAt updatedAt lastEditedAt
  path line originalLine startLine originalStartLine
  outdated state
  commit { oid } originalCommit { oid }
  replyTo { id }
  pullRequestReview { id state }
  viewerDidAuthor viewerCanDelete
`;

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
}`;

const ThreadCommentsPage = z.object({
  data: z.object({
    node: z
      .object({
        comments: z.object({ pageInfo: GqlPageInfo, nodes: z.array(GqlReviewCommentRaw) }),
      })
      .nullable(),
  }),
  errors: z.array(GqlError).optional(),
});

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
}`;

export interface ReviewThreadsResult {
  prId: string;
  headRefOid: string;
  baseRefOid: string;
  threads: GqlReviewThreadRaw[];
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
          nodes: z.array(RemoteViewedFile),
        }),
      }),
    }),
  }),
  errors: z.array(GqlError).optional(),
});

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
}`;

export interface FilesViewedResult {
  prId: string;
  headRefOid: string;
  files: RemoteViewedFile[];
}

const BatchMutationResponse = z.object({
  data: z.unknown().nullable().optional(),
  errors: z.array(GqlError).optional(),
});

export interface ViewedChange {
  path: string;
  viewed: boolean;
}

const PendingReviewResponse = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        reviews: z.object({
          nodes: z.array(z.object({ id: NodeId, commit: z.object({ oid: Sha }).nullable() })),
        }),
      }),
    }),
  }),
  errors: z.array(GqlError).optional(),
});

const PENDING_REVIEW_QUERY = `
query($owner:String!, $name:String!, $number:Int!) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      reviews(first:1, states:[PENDING]) { nodes { id commit { oid } } }
    }
  }
}`;

const CreateReviewResponse = z.object({
  data: z.object({
    addPullRequestReview: z.object({ pullRequestReview: z.object({ id: NodeId }) }),
  }),
  errors: z.array(GqlError).optional(),
});

const CREATE_REVIEW_QUERY = `
mutation($pr:ID!, $oid:GitObjectID!) {
  addPullRequestReview(input:{ pullRequestId:$pr, commitOID:$oid, body:"" }) {
    pullRequestReview { id }
  }
}`;

const NewThreadComment = z.object({
  id: NodeId,
  createdAt: IsoDate,
  updatedAt: IsoDate,
  pullRequestReview: z.object({ id: NodeId, state: ReviewState }).nullable(),
});

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
          comments: z.object({ nodes: z.array(NewThreadComment) }),
        }),
      })
      .nullable(),
  }),
  errors: z.array(GqlError).optional(),
});

const ADD_THREAD_LINE_QUERY = `
mutation($reviewId:ID!, $path:String!, $body:String!, $line:Int!, $side:DiffSide!, $startLine:Int, $startSide:DiffSide, $subjectType:PullRequestReviewThreadSubjectType!) {
  addPullRequestReviewThread(input:{ pullRequestReviewId:$reviewId, path:$path, body:$body, line:$line, side:$side, startLine:$startLine, startSide:$startSide, subjectType:$subjectType }) {
    thread { id isResolved path line startLine diffSide
      comments(first:1){ nodes { id createdAt updatedAt pullRequestReview { id state } } } }
  }
}`;

const ADD_THREAD_FILE_QUERY = `
mutation($reviewId:ID!, $path:String!, $body:String!) {
  addPullRequestReviewThread(input:{ pullRequestReviewId:$reviewId, path:$path, body:$body, subjectType:FILE }) {
    thread { id isResolved path line startLine diffSide
      comments(first:1){ nodes { id createdAt updatedAt pullRequestReview { id state } } } }
  }
}`;

export interface NewThreadInput {
  pullRequestReviewId: string;
  path: string;
  body: string;
  line: number | null;
  side: DiffSide;
  startLine?: number | null;
  startSide?: DiffSide | null;
}

export interface NewThreadResult {
  thread: {
    id: string;
    isResolved: boolean;
    path: string;
    line: number | null;
    startLine: number | null;
    diffSide: DiffSide;
  };
  rootComment: z.infer<typeof NewThreadComment>;
  isFile: boolean;
}

type AddThreadResponseType = z.infer<typeof AddThreadResponse>;
type ThreadPayload = NonNullable<
  AddThreadResponseType['data']['addPullRequestReviewThread']
>['thread'];

const GENERAL_COMMENT_FIELDS = `
  id
  author { login }
  body createdAt updatedAt lastEditedAt
  viewerDidAuthor viewerCanDelete
`;

const GeneralCommentsPage = z.object({
  data: z.object({
    repository: z.object({
      pullRequest: z.object({
        id: NodeId,
        comments: z.object({ pageInfo: GqlPageInfo, nodes: z.array(GqlIssueCommentRaw) }),
      }),
    }),
  }),
  errors: z.array(GqlError).optional(),
});

const GENERAL_COMMENTS_QUERY = `
query($owner:String!, $name:String!, $number:Int!, $endCursor:String) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      id
      comments(first:50, after:$endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes { ${GENERAL_COMMENT_FIELDS} }
      }
    }
  }
}`;

export interface GeneralCommentsResult {
  prId: string;
  comments: GqlIssueCommentRaw[];
}

const AddGeneralCommentResponse = z.object({
  data: z.object({
    addComment: z
      .object({ commentEdge: z.object({ node: GqlIssueCommentRaw }).nullable() })
      .nullable(),
  }),
  errors: z.array(GqlError).optional(),
});

const ADD_GENERAL_COMMENT_QUERY = `
mutation($subjectId:ID!, $body:String!) {
  addComment(input:{ subjectId:$subjectId, body:$body }) {
    commentEdge { node { ... on IssueComment { ${GENERAL_COMMENT_FIELDS} } } }
  }
}`;

const UpdateGeneralCommentResponse = z.object({
  data: z.object({
    updateIssueComment: z.object({
      issueComment: z.object({ id: NodeId, updatedAt: IsoDate, lastEditedAt: IsoDate.nullable() }),
    }),
  }),
  errors: z.array(GqlError).optional(),
});

const UPDATE_GENERAL_COMMENT_QUERY = `
mutation($id:ID!, $body:String!) {
  updateIssueComment(input:{ id:$id, body:$body }) {
    issueComment { id updatedAt lastEditedAt }
  }
}`;

const DeleteGeneralCommentResponse = z.object({
  data: z.object({
    deleteIssueComment: z.object({ clientMutationId: z.string().nullable() }).nullable(),
  }),
  errors: z.array(GqlError).optional(),
});

const DELETE_GENERAL_COMMENT_QUERY = `
mutation($id:ID!) {
  deleteIssueComment(input:{id:$id}) { clientMutationId }
}`;

const DeleteCommentResponse = z.object({
  data: z.object({
    deletePullRequestReviewComment: z
      .object({ pullRequestReview: z.object({ id: NodeId }).nullable() })
      .nullable(),
  }),
  errors: z.array(GqlError).optional(),
});

const DELETE_COMMENT_QUERY = `
mutation($id:ID!) {
  deletePullRequestReviewComment(input:{id:$id}) { pullRequestReview { id } }
}`;

const UpdateCommentResponse = z.object({
  data: z.object({
    updatePullRequestReviewComment: z.object({
      pullRequestReviewComment: z.object({
        id: NodeId,
        updatedAt: IsoDate,
        lastEditedAt: IsoDate.nullable(),
      }),
    }),
  }),
  errors: z.array(GqlError).optional(),
});

const UPDATE_COMMENT_QUERY = `
mutation($id:ID!, $body:String!) {
  updatePullRequestReviewComment(input:{ pullRequestReviewCommentId:$id, body:$body }) {
    pullRequestReviewComment { id updatedAt lastEditedAt }
  }
}`;

export interface UpdatedComment {
  updatedAt: string;
  lastEditedAt: string | null;
}

const SubmitReviewResponse = z.object({
  data: z.object({
    submitPullRequestReview: z.object({
      pullRequestReview: z.object({ id: NodeId, state: ReviewState }),
    }),
  }),
  errors: z.array(GqlError).optional(),
});

const SUBMIT_REVIEW_QUERY = `
mutation($reviewId:ID!, $body:String) {
  submitPullRequestReview(input:{ pullRequestReviewId:$reviewId, event:COMMENT, body:$body }) {
    pullRequestReview { id state }
  }
}`;

const PR_VIEW_CONCURRENCY = 5;

const ReplyComment = NewThreadComment.extend({ replyTo: z.object({ id: NodeId }).nullable() });

const AddReplyResponse = z.object({
  data: z.object({ addPullRequestReviewThreadReply: z.object({ comment: ReplyComment }) }),
  errors: z.array(GqlError).optional(),
});

const ADD_REPLY_QUERY = `
mutation($threadId:ID!, $body:String!, $reviewId:ID) {
  addPullRequestReviewThreadReply(input:{ pullRequestReviewThreadId:$threadId, body:$body, pullRequestReviewId:$reviewId }) {
    comment { id createdAt updatedAt replyTo { id } pullRequestReview { id state } }
  }
}`;

interface ProjectStore {
  getProject: typeof defaultGetProject;
}

export class GhService {
  private readonly getProject: typeof defaultGetProject;

  constructor(deps: ProjectStore = { getProject: defaultGetProject }) {
    this.getProject = deps.getProject;
  }

  async repoRefFor(projectId: string): Promise<RepoRef> {
    const project = await this.getProject(projectId);
    if (!project) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${projectId}`);
    return { owner: project.owner, repo: project.repo };
  }

  async listPrs(owner: string, repo: string, search?: string): Promise<PrListItem[]> {
    return runJson(z.array(PrListItem), 'gh', buildPrListArgs(owner, repo, search), ghOpts());
  }

  async viewPr(owner: string, repo: string, number: number): Promise<PrSummary> {
    return runJson(
      PrSummary,
      'gh',
      ['pr', 'view', String(number), '-R', `${owner}/${repo}`, '--json', PR_SUMMARY_FIELDS],
      ghOpts(),
    );
  }

  async projectOverview(
    owner: string,
    repo: string,
  ): Promise<ReturnType<typeof parseProjectOverview>> {
    const res = await this.graphql(ProjectOverviewResponse, PROJECT_OVERVIEW_QUERY, {
      owner,
      name: repo,
    });
    return parseProjectOverview(res);
  }

  async prOverview(
    owner: string,
    repo: string,
    number: number,
  ): Promise<ReturnType<typeof normalizePrOverview>> {
    const raw = await runJson(
      GhPrOverview,
      'gh',
      ['pr', 'view', String(number), '-R', `${owner}/${repo}`, '--json', PR_OVERVIEW_FIELDS],
      ghOpts(),
    );
    return normalizePrOverview(raw);
  }

  // gh returns a PR's commits in topological order, oldest first.
  async viewPrCommits(owner: string, repo: string, number: number): Promise<Commit[]> {
    const { commits } = await runJson(
      PrCommitsResponse,
      'gh',
      ['pr', 'view', String(number), '-R', `${owner}/${repo}`, '--json', 'commits'],
      ghOpts(),
    );
    return commits;
  }

  async viewPrHeadBase(
    owner: string,
    repo: string,
    number: number,
  ): Promise<{ headRefOid: string; baseRefOid: string }> {
    return runJson(
      PrHeadBase,
      'gh',
      ['pr', 'view', String(number), '-R', `${owner}/${repo}`, '--json', 'headRefOid,baseRefOid'],
      ghOpts(),
    );
  }

  async createPr(owner: string, repo: string, input: CreatePrInput): Promise<PrSummary> {
    const { stdout } = await run(
      'gh',
      [
        'pr',
        'create',
        '-R',
        `${owner}/${repo}`,
        '--base',
        input.base,
        '--head',
        input.head,
        '--title',
        input.title,
        // `--body-file -` reads the body from stdin instead of argv, where it
        // would otherwise be visible to every other process on the machine.
        '--body-file',
        '-',
      ],
      ghOpts({ stdin: input.body }),
    );
    const number = parsePrCreateUrl(stdout);
    return this.viewPr(owner, repo, number);
  }

  async createIssue(owner: string, repo: string, input: CreateIssueInput): Promise<IssueRef> {
    const { stdout } = await run(
      'gh',
      ['issue', 'create', '-R', `${owner}/${repo}`, '--title', input.title, '--body-file', '-'],
      ghOpts({ stdin: input.body }),
    );
    return parseIssueCreateUrl(stdout);
  }

  // `gh api --paginate` concatenates REST pages into one JSON array.
  async listPrsForCommit(owner: string, repo: string, sha: string): Promise<number[]> {
    const items = await runJson(
      z.array(CommitPrRaw),
      'gh',
      ['api', `repos/${owner}/${repo}/commits/${sha}/pulls`, '--paginate'],
      ghOpts(),
    );
    return items.map((i) => i.number);
  }

  private async fetchRemainingPrFiles(
    owner: string,
    repo: string,
    number: number,
    after: string,
  ): Promise<string[]> {
    const out: string[] = [];
    let cursor: string | null = after;
    for (;;) {
      const page: z.output<typeof PrFilesPageResponse> = await this.graphql(
        PrFilesPageResponse,
        PR_FILES_PAGE_QUERY,
        {
          owner,
          name: repo,
          number,
          endCursor: cursor,
        },
      );
      const files = page.data.repository.pullRequest?.files;
      if (!files) break;
      out.push(...files.nodes.map((f) => f.path));
      if (!files.pageInfo.hasNextPage) break;
      cursor = files.pageInfo.endCursor;
    }
    return out;
  }

  async fetchPrsFiles(
    owner: string,
    repo: string,
    numbers: number[],
  ): Promise<Map<number, string[]>> {
    if (numbers.length === 0) return new Map();
    const map = new Map<number, string[]>();
    for (const batch of chunk(numbers, PRS_FILES_CHUNK_SIZE)) {
      const { query, variables } = buildPrsFilesQuery(batch);
      const res = await this.graphql(PrsFilesResponse, query, { owner, name: repo, ...variables });
      for (const [number, files] of parsePrsFilesResponse(res.data.repository)) {
        map.set(number, files);
      }
      const stragglers = parsePrsFilesPageInfo(res.data.repository);
      for (const [number, cursor] of stragglers) {
        const rest = await this.fetchRemainingPrFiles(owner, repo, number, cursor);
        map.set(number, [...(map.get(number) ?? []), ...rest]);
      }
    }
    return map;
  }

  async listPrsFiltered(owner: string, repo: string, filter: PrListFilter): Promise<PrListItem[]> {
    let candidates: PrListItem[];
    if (filter.commit) {
      const numbers = await this.listPrsForCommit(owner, repo, filter.commit);
      candidates = await mapWithConcurrency(numbers, PR_VIEW_CONCURRENCY, (n) =>
        this.viewPr(owner, repo, n),
      );
      if (filter.search) {
        const search = filter.search;
        candidates = candidates.filter((c) => matchesPrSearch(c, search));
      }
    } else {
      candidates = await this.listPrs(owner, repo, filter.search);
    }
    if (filter.path && candidates.length > 0) {
      const filesByNumber = await this.fetchPrsFiles(
        owner,
        repo,
        candidates.map((c) => c.number),
      );
      candidates = filterPrsByPath(candidates, filesByNumber, filter.path);
    }
    return candidates;
  }

  private async fetchUser(): Promise<z.infer<typeof GhUser>> {
    return runJson(GhUser, 'gh', ['api', 'user'], ghOpts());
  }

  private async hasActiveAuth(): Promise<boolean> {
    const status = await runJson(
      GhAuthStatus,
      'gh',
      ['auth', 'status', '--active', '--json', 'hosts'],
      ghOpts(),
    );
    return Object.values(status.hosts)
      .flat()
      .some((h) => h.active && h.state === 'success');
  }

  async viewer(): Promise<Viewer | null> {
    if (!(await this.hasActiveAuth())) return null;
    const user = await this.fetchUser();
    return {
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      htmlUrl: user.html_url,
    };
  }

  async listViewerRepos(): Promise<ViewerRepo[]> {
    if (!(await this.hasActiveAuth())) return [];
    const repos: ViewerRepo[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: z.output<typeof ViewerReposResponse> = await this.graphql(
        ViewerReposResponse,
        VIEWER_REPOS_QUERY,
        {
          endCursor: cursor,
        },
      );
      const { nodes, pageInfo } = page.data.viewer.repositories;
      repos.push(...nodes.map((n) => ({ owner: n.owner.login, repo: n.name, url: n.url })));
      if (!pageInfo.hasNextPage || repos.length >= MAX_VIEWER_REPOS) break;
      cursor = pageInfo.endCursor;
    }
    return repos;
  }

  // `gh api --paginate` hangs on GraphQL queries whose cursor variable is not
  // named exactly `$endCursor`.
  private async graphql<T extends { errors?: GqlError[] }>(
    schema: z.ZodType<T>,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<T> {
    const result = await runJson(schema, 'gh', ['api', 'graphql', '--input', '-'], {
      ...ghOpts(),
      stdin: JSON.stringify({ query, variables }),
    });
    checkGqlErrors(result.errors);
    return result;
  }

  private async fetchRemainingThreadComments(
    threadId: string,
    after: string | null,
  ): Promise<GqlReviewCommentRaw[]> {
    const out: GqlReviewCommentRaw[] = [];
    let cursor = after;
    for (;;) {
      const page = await this.graphql(ThreadCommentsPage, THREAD_COMMENTS_QUERY, {
        threadId,
        endCursor: cursor,
      });
      const comments = page.data.node?.comments;
      if (!comments) break;
      out.push(...comments.nodes);
      if (!comments.pageInfo.hasNextPage) break;
      cursor = comments.pageInfo.endCursor;
    }
    return out;
  }

  async fetchReviewThreads(
    owner: string,
    repo: string,
    number: number,
  ): Promise<ReviewThreadsResult> {
    const threads: GqlReviewThreadRaw[] = [];
    let prId: string;
    let headRefOid: string;
    let baseRefOid: string;
    let cursor: string | null = null;
    for (;;) {
      const page: z.output<typeof GqlReviewThreadsPage> = await this.graphql(
        GqlReviewThreadsPage,
        REVIEW_THREADS_QUERY,
        {
          owner,
          name: repo,
          number,
          endCursor: cursor,
        },
      );
      const pr = page.data.repository.pullRequest;
      prId = pr.id;
      headRefOid = pr.headRefOid;
      baseRefOid = pr.baseRefOid;
      for (const thread of pr.reviewThreads.nodes) {
        if (thread.comments.pageInfo.hasNextPage) {
          const rest = await this.fetchRemainingThreadComments(
            thread.id,
            thread.comments.pageInfo.endCursor,
          );
          thread.comments.nodes.push(...rest);
        }
        threads.push(thread);
      }
      if (!pr.reviewThreads.pageInfo.hasNextPage) break;
      cursor = pr.reviewThreads.pageInfo.endCursor;
    }
    return { prId, headRefOid, baseRefOid, threads };
  }

  async fetchViewedFiles(owner: string, repo: string, number: number): Promise<FilesViewedResult> {
    const files: RemoteViewedFile[] = [];
    let prId: string;
    let headRefOid: string;
    let cursor: string | null = null;
    for (;;) {
      const page: z.output<typeof FilesViewedPage> = await this.graphql(
        FilesViewedPage,
        FILES_VIEWED_QUERY,
        {
          owner,
          name: repo,
          number,
          endCursor: cursor,
        },
      );
      const pr = page.data.repository.pullRequest;
      prId = pr.id;
      headRefOid = pr.headRefOid;
      files.push(...pr.files.nodes);
      if (!pr.files.pageInfo.hasNextPage) break;
      cursor = pr.files.pageInfo.endCursor;
    }
    return { prId, headRefOid, files };
  }

  async setFilesViewed(pullRequestId: string, changes: ViewedChange[]): Promise<void> {
    if (changes.length === 0) return;
    await withBatches(changes, VIEWED_MUTATION_CHUNK_SIZE, async (batch) => {
      const varDecls = ['$pr:ID!'];
      const fields: string[] = [];
      const variables: Record<string, unknown> = { pr: pullRequestId };
      batch.forEach((c, i) => {
        const pathVar = `p${i}`;
        varDecls.push(`$${pathVar}:String!`);
        variables[pathVar] = c.path;
        const mutation = c.viewed ? 'markFileAsViewed' : 'unmarkFileAsViewed';
        fields.push(
          `f${i}: ${mutation}(input:{pullRequestId:$pr, path:$${pathVar}}) { clientMutationId }`,
        );
      });
      const query = `mutation(${varDecls.join(', ')}) {\n${fields.join('\n')}\n}`;
      await this.graphql(BatchMutationResponse, query, variables);
    });
  }

  async findPendingReview(
    owner: string,
    repo: string,
    number: number,
  ): Promise<{ id: string } | null> {
    const page = await this.graphql(PendingReviewResponse, PENDING_REVIEW_QUERY, {
      owner,
      name: repo,
      number,
    });
    const node = page.data.repository.pullRequest.reviews.nodes[0];
    return node ? { id: node.id } : null;
  }

  // GitHub allows only one pending review per user per PR.
  async createPendingReview(pullRequestId: string, commitOid: string): Promise<string> {
    const res = await this.graphql(CreateReviewResponse, CREATE_REVIEW_QUERY, {
      pr: pullRequestId,
      oid: commitOid,
    });
    return res.data.addPullRequestReview.pullRequestReview.id;
  }

  private firstComment(res: AddThreadResponseType): {
    thread: ThreadPayload;
    root: z.infer<typeof NewThreadComment>;
  } {
    const thread = res.data.addPullRequestReviewThread?.thread;
    if (!thread)
      throw new AppError('GRAPHQL_ERROR', 'addPullRequestReviewThread returned no thread');
    const root = thread.comments.nodes[0];
    if (!root)
      throw new AppError('GRAPHQL_ERROR', 'addPullRequestReviewThread returned no root comment');
    return { thread, root };
  }

  private async addThreadAsFile(
    pullRequestReviewId: string,
    path: string,
    body: string,
  ): Promise<NewThreadResult> {
    const res = await this.graphql(AddThreadResponse, ADD_THREAD_FILE_QUERY, {
      reviewId: pullRequestReviewId,
      path,
      body,
    });
    const { thread, root } = this.firstComment(res);
    return { thread, rootComment: root, isFile: true };
  }

  // GitHub rejects a LINE-anchored review comment on a line outside the diff
  // with a 422 "must be part of the diff" error.
  async addReviewThread(input: NewThreadInput): Promise<NewThreadResult> {
    if (input.line === null)
      return this.addThreadAsFile(input.pullRequestReviewId, input.path, input.body);
    const line = input.line;
    try {
      const res = await this.graphql(AddThreadResponse, ADD_THREAD_LINE_QUERY, {
        reviewId: input.pullRequestReviewId,
        path: input.path,
        body: input.body,
        line,
        side: input.side,
        startLine: input.startLine ?? null,
        startSide: input.startSide ?? null,
        subjectType: 'LINE',
      });
      const { thread, root } = this.firstComment(res);
      return { thread, rootComment: root, isFile: false };
    } catch (e) {
      if (!isLineNotInDiffError(e)) throw e;
      const fallbackBody = `${input.path}:${line}\n\n${input.body}`;
      return this.addThreadAsFile(input.pullRequestReviewId, input.path, fallbackBody);
    }
  }

  // GitHub accepts replies only to a thread root.
  async addReviewThreadReply(
    threadId: string,
    body: string,
    reviewId?: string | null,
  ): Promise<z.infer<typeof ReplyComment>> {
    const res = await this.graphql(AddReplyResponse, ADD_REPLY_QUERY, {
      threadId,
      body,
      reviewId: reviewId ?? null,
    });
    return res.data.addPullRequestReviewThreadReply.comment;
  }

  async deleteReviewComment(commentId: string): Promise<void> {
    await this.graphql(DeleteCommentResponse, DELETE_COMMENT_QUERY, { id: commentId });
  }

  async updateReviewComment(commentId: string, body: string): Promise<UpdatedComment> {
    const res = await this.graphql(UpdateCommentResponse, UPDATE_COMMENT_QUERY, {
      id: commentId,
      body,
    });
    const c = res.data.updatePullRequestReviewComment.pullRequestReviewComment;
    return { updatedAt: c.updatedAt, lastEditedAt: c.lastEditedAt };
  }

  async submitReview(reviewId: string, body?: string): Promise<void> {
    await this.graphql(SubmitReviewResponse, SUBMIT_REVIEW_QUERY, { reviewId, body: body ?? null });
  }

  // General PR comments (IssueComments) are a separate connection from
  // `reviewThreads`, with no path/line/side and no review/pending state.
  async fetchGeneralComments(
    owner: string,
    repo: string,
    number: number,
  ): Promise<GeneralCommentsResult> {
    const comments: GqlIssueCommentRaw[] = [];
    let prId: string;
    let cursor: string | null = null;
    for (;;) {
      const page: z.output<typeof GeneralCommentsPage> = await this.graphql(
        GeneralCommentsPage,
        GENERAL_COMMENTS_QUERY,
        {
          owner,
          name: repo,
          number,
          endCursor: cursor,
        },
      );
      const pr = page.data.repository.pullRequest;
      prId = pr.id;
      comments.push(...pr.comments.nodes);
      if (!pr.comments.pageInfo.hasNextPage) break;
      cursor = pr.comments.pageInfo.endCursor;
    }
    return { prId, comments };
  }

  async addGeneralComment(prId: string, body: string): Promise<GqlIssueCommentRaw> {
    const res = await this.graphql(AddGeneralCommentResponse, ADD_GENERAL_COMMENT_QUERY, {
      subjectId: prId,
      body,
    });
    const node = res.data.addComment?.commentEdge?.node;
    if (!node) throw new AppError('GRAPHQL_ERROR', 'addComment returned no comment');
    return node;
  }

  async updateGeneralComment(commentId: string, body: string): Promise<UpdatedComment> {
    const res = await this.graphql(UpdateGeneralCommentResponse, UPDATE_GENERAL_COMMENT_QUERY, {
      id: commentId,
      body,
    });
    const c = res.data.updateIssueComment.issueComment;
    return { updatedAt: c.updatedAt, lastEditedAt: c.lastEditedAt };
  }

  async deleteGeneralComment(commentId: string): Promise<void> {
    await this.graphql(DeleteGeneralCommentResponse, DELETE_GENERAL_COMMENT_QUERY, {
      id: commentId,
    });
  }
}

export const ghService = new GhService();
