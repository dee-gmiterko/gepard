import type { HandlerMap } from './registry';
import { ghService } from '../services/gh';
import { gitService } from '../services/git';
import { syncService } from '../services/sync';
import { createProjectsHandlers } from './handlers/projects';
import { createPrsHandlers } from './handlers/prs';
import { createFilesHandlers } from './handlers/files';
import { searchHandlers } from './handlers/search';
import { createCommentsHandlers } from './handlers/comments';
import { createSyncHandlers } from './handlers/sync';
import { logHandlers } from './handlers/log';
import { extensionsHandlers } from './handlers/extensions';
import { grammarsHandlers } from './handlers/grammars';
import { themeHandlers } from './handlers/theme';
import { localesHandlers } from './handlers/locales';
import { keybindingsHandlers } from './handlers/keybindings';

export const handlers: HandlerMap = {
  ...createProjectsHandlers(ghService, gitService),
  ...createPrsHandlers(ghService, gitService),
  ...createFilesHandlers(gitService),
  ...searchHandlers,
  ...createCommentsHandlers(gitService),
  ...createSyncHandlers(ghService, syncService),
  ...logHandlers,
  ...extensionsHandlers,
  ...grammarsHandlers,
  ...themeHandlers,
  ...localesHandlers,
  ...keybindingsHandlers,
};
