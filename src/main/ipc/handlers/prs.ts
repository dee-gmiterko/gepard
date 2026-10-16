import type { HandlerMap } from '../dispatch';
import type { GhService } from '../../services/gh';
import type { GitService } from '../../services/git';
import type { ReviewStore } from '../../store/review';
import {
  CODEOWNERS_PATHS,
  ownersOf,
  parseCodeowners,
  type CodeownersRule,
} from '../../helpers/codeowners';

export class PrsHandlers {
  constructor(
    private readonly gh: GhService,
    private readonly git: GitService,
    private readonly review: ReviewStore,
  ) {}

  toHandlerMap(): Pick<
    HandlerMap,
    | 'pr.list'
    | 'pr.view'
    | 'pr.commits'
    | 'pr.checkout'
    | 'pr.branches'
    | 'pr.create'
    | 'issues.create'
    | 'commits.list'
    | 'overview.project'
    | 'overview.pr'
    | 'overview.owners'
    | 'checks.annotations'
  > {
    return {
      'pr.list': async ({ projectId, search, commit, path }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        return this.gh.listPrsFiltered(owner, repo, { search, commit, path });
      },

      'pr.view': async ({ projectId, pr }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        return this.gh.viewPr(owner, repo, pr);
      },

      'pr.commits': async ({ projectId, pr, path }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        const commits = await this.gh.viewPrCommits(owner, repo, pr);
        if (!path) return commits;
        const oids = commits.map((c) => c.oid);
        await this.git.ensurePrCommitsFetched(projectId, pr, oids);
        const touching = await this.git.commitsTouchingPath(projectId, oids, path);
        return commits.filter((c) => touching.has(c.oid));
      },

      'pr.checkout': async ({ projectId, target }) => {
        if (target.kind === 'pr') {
          const { owner, repo } = await this.gh.repoRefFor(projectId);
          // A PR's headRefOid changes each time the author pushes.
          const { headRefOid, baseRefOid } = await this.gh.viewPrHeadBase(owner, repo, target.pr);
          return this.git.checkoutTarget(projectId, {
            kind: 'pr',
            pr: target.pr,
            headRefOid,
            baseRefOid,
          });
        }
        return this.git.checkoutTarget(projectId, target);
      },

      'pr.branches': ({ projectId }) => this.git.listBranches(projectId),

      'pr.create': async ({ projectId, base, head, title, body }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        return this.gh.createPr(owner, repo, { base, head, title, body });
      },

      'issues.create': async ({ projectId, title, body, clearUnassignedThreadIds }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        const issue = await this.gh.createIssue(owner, repo, { title, body });
        if (clearUnassignedThreadIds.length > 0)
          await this.review.clearUnassignedThreads(projectId, clearUnassignedThreadIds);
        return issue;
      },

      'checks.annotations': async ({ projectId, sha }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        return this.gh.commitAnnotations(owner, repo, sha);
      },

      'overview.project': async ({ projectId }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        return this.gh.projectOverview(owner, repo);
      },

      'overview.pr': async ({ projectId, pr }) => {
        const { owner, repo } = await this.gh.repoRefFor(projectId);
        return this.gh.prOverview(owner, repo, pr);
      },

      'overview.owners': async ({ projectId, base, head }) => {
        let rules: CodeownersRule[] | null = null;
        for (const path of CODEOWNERS_PATHS) {
          const content = await this.git.fileContentAt(projectId, head, path).catch(() => null);
          if (content?.kind === 'text') {
            rules = parseCodeowners(content.text);
            break;
          }
        }
        if (!rules) return null;
        const files = await this.git.changedFiles(projectId, base, head);
        return Object.fromEntries(files.map((f) => [f.path, ownersOf(rules, f.path)]));
      },

      'commits.list': ({ projectId, search, path, limit }) =>
        this.git.listCommits(projectId, { search, path, limit }),
    };
  }
}
