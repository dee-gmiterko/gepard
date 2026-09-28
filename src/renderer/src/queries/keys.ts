export const qk = {
  all: ['gepard'] as const,
  viewer: () => [...qk.all, 'viewer'] as const,
  viewerRepos: () => [...qk.all, 'viewerRepos'] as const,
  projects: () => [...qk.all, 'projects'] as const,
  extensions: () => [...qk.all, 'extensions'] as const,
  extensionsDir: () => [...qk.all, 'extensionsDir'] as const,
  themeTemplate: () => [...qk.all, 'themeTemplate'] as const,
  themes: () => [...qk.all, 'themes'] as const,
  project: (projectId: string) => [...qk.all, 'project', projectId] as const,
  open: (p: string) => [...qk.project(p), 'open'] as const,
  commits: (p: string, search?: string, path?: string) =>
    [...qk.project(p), 'commits', search, path] as const,
  prsAll: (p: string) => [...qk.project(p), 'prs'] as const,
  prs: (p: string, search?: string, commit?: string, path?: string) =>
    [...qk.prsAll(p), search, commit, path] as const,
  branches: (p: string) => [...qk.project(p), 'branches'] as const,
  pr: (p: string, pr: number) => [...qk.project(p), 'pr', pr] as const,
  prSummary: (p: string, pr: number) => [...qk.pr(p, pr), 'summary'] as const,
  prCommits: (p: string, pr: number, path?: string) => [...qk.pr(p, pr), 'commits', path] as const,
  comments: (p: string, pr: number) => [...qk.pr(p, pr), 'comments'] as const,
  viewed: (p: string, pr: number) => [...qk.pr(p, pr), 'viewed'] as const,
  pendingCount: (p: string, pr: number) => [...qk.pr(p, pr), 'pendingCount'] as const,
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
