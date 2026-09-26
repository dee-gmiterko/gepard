// Zod-free channel/event name lists. The preload runs with sandbox: true and
// must be a self-contained bundle that requires nothing but `electron`, so it
// imports only this file. contract.ts `satisfies` these lists, so adding a
// channel in one place without the other is a compile error.
//
// This is the FULL contract for the spec (docs/gh-large-review.md), not the
// report 04 §2.3 prototype subset: projects/clone, PR list/commits,
// changed files, file content, file diff rows, trees, search,
// symbols/definitions/references, comments, viewed, sync, index status.
export const channelNames = [
  'app.viewer',
  'projects.list',
  'projects.add',
  'projects.open',
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
  'index.get',
  'log.write'
] as const

export const eventNames = ['clone.progress', 'index.status', 'theme.changed', 'app.error'] as const

export type ChannelNameList = (typeof channelNames)[number]
export type EventNameList = (typeof eventNames)[number]
