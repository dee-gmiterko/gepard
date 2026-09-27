// The preload runs with sandbox: true and must be a self-contained bundle
// that imports nothing but `electron`, so this file has no zod dependency.
export const channelNames = [
  'app.viewer',
  'app.viewerRepos',
  'projects.list',
  'projects.add',
  'projects.open',
  'projects.setTargeting',
  'projects.remove',
  'clone.start',
  'pr.list',
  'pr.commits',
  'pr.checkout',
  'commits.list',
  'files.changed',
  'files.diff',
  'files.content',
  'trees.get',
  'search.run',
  'symbols.line',
  'symbols.definition',
  'symbols.workspace',
  'comments.list',
  'comments.upsert',
  'comments.delete',
  'viewed.list',
  'viewed.set',
  'sync.run',
  'sync.pendingCount',
  'index.get',
  'log.write',
  'extensions.list',
  'extensions.setEnabled',
  'extensions.install',
  'extensions.dir'
] as const

export const eventNames = ['clone.progress', 'index.status', 'theme.changed', 'app.error'] as const

export type ChannelNameList = (typeof channelNames)[number]
export type EventNameList = (typeof eventNames)[number]
