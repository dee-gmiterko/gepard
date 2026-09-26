// Thin dispatch table only (report 04 §2.4, §8): composed from one typed
// partial handler map per domain so feature work on one domain never touches
// another domain's file. A missing channel here is a compile error (HandlerMap
// requires every key in ChannelName).
import type { HandlerMap } from './registry'
import { projectsHandlers } from './handlers/projects'
import { prsHandlers } from './handlers/prs'
import { filesHandlers } from './handlers/files'
import { searchHandlers } from './handlers/search'
import { commentsHandlers } from './handlers/comments'
import { syncHandlers } from './handlers/sync'
import { logHandlers } from './handlers/log'

export const handlers: HandlerMap = {
  ...projectsHandlers,
  ...prsHandlers,
  ...filesHandlers,
  ...searchHandlers,
  ...commentsHandlers,
  ...syncHandlers,
  ...logHandlers
}
