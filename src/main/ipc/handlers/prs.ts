import type { HandlerMap } from '../registry'
import * as gh from '../../services/gh'
import * as git from '../../services/git'

export const prsHandlers: Pick<
  HandlerMap,
  'pr.list' | 'pr.commits' | 'pr.checkout' | 'commits.list'
> = {
  'pr.list': async ({ projectId, search, commit, path }) => {
    const { owner, repo } = await gh.repoRefFor(projectId)
    return gh.listPrsFiltered(owner, repo, { search, commit, path })
  },

  'pr.commits': async ({ projectId, pr, path }) => {
    const { owner, repo } = await gh.repoRefFor(projectId)
    const commits = await gh.viewPrCommits(owner, repo, pr)
    if (!path) return commits
    const oids = commits.map((c) => c.oid)
    await git.ensurePrCommitsFetched(projectId, pr, oids)
    const touching = await git.commitsTouchingPath(projectId, oids, path)
    return commits.filter((c) => touching.has(c.oid))
  },

  'pr.checkout': async ({ projectId, target }) => {
    if (target.kind === 'pr') {
      const { owner, repo } = await gh.repoRefFor(projectId)
      // A PR's headRefOid changes each time the author pushes, so it's
      // fetched fresh here rather than reused.
      const { headRefOid, baseRefOid } = await gh.viewPrHeadBase(owner, repo, target.pr)
      return git.checkoutTarget(projectId, { kind: 'pr', pr: target.pr, headRefOid, baseRefOid })
    }
    return git.checkoutTarget(projectId, target)
  },

  'commits.list': ({ projectId, search, path, limit }) =>
    git.listCommits(projectId, { search, path, limit })
}
