import type { HandlerMap } from './registry';
import { ghService, gitService, launchService, syncService } from '../di';
import { createProjectsHandlers } from './handlers/projects';
import { createLaunchHandlers } from './handlers/launch';
import { createPrsHandlers } from './handlers/prs';
import { createFilesHandlers } from './handlers/files';
import { searchHandlers } from './handlers/search';
import { createCommentsHandlers } from './handlers/comments';
import { createSyncHandlers } from './handlers/sync';
import { connectivityHandlers } from './handlers/connectivity';
import { logHandlers } from './handlers/log';
import { extensionsHandlers } from './handlers/extensions';
import { grammarsHandlers } from './handlers/grammars';
import { systemPreferenceHandlers } from './handlers/systemPreference';
import { themeHandlers } from './handlers/theme';
import { localesHandlers } from './handlers/locales';
import { keybindingsHandlers } from './handlers/keybindings';
import { contextMenuHandlers } from './handlers/contextMenu';

export const handlers: HandlerMap = {
  ...createProjectsHandlers(ghService, gitService),
  ...createLaunchHandlers(launchService),
  ...createPrsHandlers(ghService, gitService),
  ...createFilesHandlers(gitService),
  ...searchHandlers,
  ...createCommentsHandlers(gitService),
  ...createSyncHandlers(ghService, syncService),
  ...connectivityHandlers,
  ...logHandlers,
  ...extensionsHandlers,
  ...grammarsHandlers,
  ...systemPreferenceHandlers,
  ...themeHandlers,
  ...localesHandlers,
  ...keybindingsHandlers,
  ...contextMenuHandlers,
};
