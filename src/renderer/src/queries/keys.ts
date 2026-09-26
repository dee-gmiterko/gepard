// Report 04 §5.2 (plus `open`, `commits`, `index`). Everything under a sha is immutable
// (staleTime: Infinity); diff endpoints: PR target -> base = merge-base
// (baseRefOid, headRefOid), head = headRefOid; commit target -> base =
// <sha>^, head = <sha>.
export const qk = {
  all: ['ghlr'] as const,
  viewer: () => [...qk.all, 'viewer'] as const,
  projects: () => [...qk.all, 'projects'] as const,
  project: (projectId: string) => [...qk.all, 'project', projectId] as const,
  /** `projects.open` result: the working tree's head (updated by checkouts). */
  open: (p: string) => [...qk.project(p), 'open'] as const,
  commits: (p: string, search?: string, path?: string) =>
    [...qk.project(p), 'commits', search, path] as const,
  prs: (p: string, search?: string) => [...qk.project(p), 'prs', search] as const,
  pr: (p: string, pr: number) => [...qk.project(p), 'pr', pr] as const,
  prCommits: (p: string, pr: number) => [...qk.pr(p, pr), 'commits'] as const,
  comments: (p: string, pr: number) => [...qk.pr(p, pr), 'comments'] as const,
  viewed: (p: string, pr: number) => [...qk.pr(p, pr), 'viewed'] as const,
  // immutable, keyed by sha -> staleTime: Infinity
  commit: (p: string, sha: string) => [...qk.project(p), 'commit', sha] as const,
  tree: (p: string, sha: string) => [...qk.commit(p, sha), 'tree'] as const,
  file: (p: string, sha: string, path: string) => [...qk.commit(p, sha), 'file', path] as const,
  changedFiles: (p: string, base: string, head: string) =>
    [...qk.project(p), 'diff', base, head, 'files'] as const,
  fileDiff: (p: string, base: string, head: string, path: string) =>
    [...qk.project(p), 'diff', base, head, 'file', path] as const,
  search: (p: string, sha: string, query: string, opts?: unknown) =>
    [...qk.commit(p, sha), 'search', query, opts] as const,
  index: (p: string) => [...qk.project(p), 'index'] as const
}
