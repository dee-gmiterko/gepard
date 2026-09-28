// The sandboxed preload imports this file and cannot load modules other than
// `electron`.
export const channelNames = [
  'app.viewer',
  'app.viewerRepos',
  'projects.list',
  'projects.add',
  'projects.open',
  'projects.setTargeting',
  'projects.setLayout',
  'projects.remove',
  'clone.start',
  'pr.list',
  'pr.view',
  'pr.commits',
  'pr.checkout',
  'pr.branches',
  'pr.create',
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
  'extensions.dir',
  'theme.getTemplateId',
  'theme.setTemplateId',
  'themes.list'
] as const

export const eventNames = ['clone.progress', 'index.status', 'theme.changed', 'app.error'] as const

export type ChannelNameList = (typeof channelNames)[number]
export type EventNameList = (typeof eventNames)[number]
