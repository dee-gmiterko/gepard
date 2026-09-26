// PRs domain: PR list and commits, repository commits, and checking out a
// target (PR head, a single commit, or the default branch head). Delegates to services/gh.ts (`gh`
// calls, report 01) and services/git.ts (`checkoutTarget`/`listCommits`).
import type { HandlerMap } from '../registry'
import * as gh from '../../services/gh'
import * as git from '../../services/git'

export const prsHandlers: Pick<
  HandlerMap,
  'pr.list' | 'pr.commits' | 'pr.checkout' | 'commits.list'
> = {
  'pr.list': async ({ projectId, search }) => {
    const { owner, repo } = await gh.repoRefFor(projectId)
    return gh.listPrs(owner, repo, search)
  },

  'pr.commits': async ({ projectId, pr }) => {
    const { owner, repo } = await gh.repoRefFor(projectId)
    return gh.viewPrCommits(owner, repo, pr)
  },

  /** `kind: 'pr'` first fetches the current head/base (report 01 §1.3:
   * `headRefOid` moves when the author pushes) via `gh pr view`, then hands
   * off to `checkoutTarget` (git.ts) for the actual checkout + reindex.
   * `commit` and `default` (no PR/commit targeted) go straight to git. */
  'pr.checkout': async ({ projectId, target }) => {
    if (target.kind === 'pr') {
      const { owner, repo } = await gh.repoRefFor(projectId)
      const { headRefOid, baseRefOid } = await gh.viewPrHeadBase(owner, repo, target.pr)
      return git.checkoutTarget(projectId, { kind: 'pr', pr: target.pr, headRefOid, baseRefOid })
    }
    return git.checkoutTarget(projectId, target)
  },

  'commits.list': ({ projectId, search, path, limit }) =>
    git.listCommits(projectId, { search, path, limit })
}
