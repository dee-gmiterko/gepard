import type { HandlerMap } from './registry'
import { projectsHandlers } from './handlers/projects'
import { prsHandlers } from './handlers/prs'
import { filesHandlers } from './handlers/files'
import { searchHandlers } from './handlers/search'
import { commentsHandlers } from './handlers/comments'
import { syncHandlers } from './handlers/sync'
import { logHandlers } from './handlers/log'
import { extensionsHandlers } from './handlers/extensions'

export const handlers: HandlerMap = {
  ...projectsHandlers,
  ...prsHandlers,
  ...filesHandlers,
  ...searchHandlers,
  ...commentsHandlers,
  ...syncHandlers,
  ...logHandlers,
  ...extensionsHandlers
}
