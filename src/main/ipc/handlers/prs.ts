import type { HandlerMap } from '../registry';
import type { GhService } from '../../services/gh';
import type { GitService } from '../../services/git';

export function createPrsHandlers(
  gh: GhService,
  git: GitService,
): Pick<
  HandlerMap,
  | 'pr.list'
  | 'pr.view'
  | 'pr.commits'
  | 'pr.checkout'
  | 'pr.branches'
  | 'pr.create'
  | 'commits.list'
  | 'overview.project'
  | 'overview.pr'
> {
  return {
    'pr.list': async ({ projectId, search, commit, path }) => {
      const { owner, repo } = await gh.repoRefFor(projectId);
      return gh.listPrsFiltered(owner, repo, { search, commit, path });
    },

    'pr.view': async ({ projectId, pr }) => {
      const { owner, repo } = await gh.repoRefFor(projectId);
      return gh.viewPr(owner, repo, pr);
    },

    'pr.commits': async ({ projectId, pr, path }) => {
      const { owner, repo } = await gh.repoRefFor(projectId);
      const commits = await gh.viewPrCommits(owner, repo, pr);
      if (!path) return commits;
      const oids = commits.map((c) => c.oid);
      await git.ensurePrCommitsFetched(projectId, pr, oids);
      const touching = await git.commitsTouchingPath(projectId, oids, path);
      return commits.filter((c) => touching.has(c.oid));
    },

    'pr.checkout': async ({ projectId, target }) => {
      if (target.kind === 'pr') {
        const { owner, repo } = await gh.repoRefFor(projectId);
        // A PR's headRefOid changes each time the author pushes.
        const { headRefOid, baseRefOid } = await gh.viewPrHeadBase(owner, repo, target.pr);
        return git.checkoutTarget(projectId, { kind: 'pr', pr: target.pr, headRefOid, baseRefOid });
      }
      return git.checkoutTarget(projectId, target);
    },

    'pr.branches': ({ projectId }) => git.listBranches(projectId),

    'pr.create': async ({ projectId, base, head, title, body }) => {
      const { owner, repo } = await gh.repoRefFor(projectId);
      return gh.createPr(owner, repo, { base, head, title, body });
    },

    'overview.project': async ({ projectId }) => {
      const { owner, repo } = await gh.repoRefFor(projectId);
      return gh.projectOverview(owner, repo);
    },

    'overview.pr': async ({ projectId, pr }) => {
      const { owner, repo } = await gh.repoRefFor(projectId);
      return gh.prOverview(owner, repo, pr);
    },

    'commits.list': ({ projectId, search, path, limit }) =>
      git.listCommits(projectId, { search, path, limit }),
  };
}
