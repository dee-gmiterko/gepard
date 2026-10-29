import type { HandlerMap } from '../dispatch';
import type { ProjectStore } from '../../store/projects';
import type { SettingsStore } from '../../store/settings';

export class HiddenFilesHandlers {
  constructor(
    private readonly settings: SettingsStore,
    private readonly projects: ProjectStore,
  ) {}

  toHandlerMap(): Pick<
    HandlerMap,
    | 'hiddenFiles.getGlobal'
    | 'hiddenFiles.setGlobal'
    | 'hiddenFiles.getProject'
    | 'hiddenFiles.setProject'
  > {
    return {
      'hiddenFiles.getGlobal': () => this.settings.getHiddenFiles(),
      'hiddenFiles.setGlobal': ({ patterns }) => this.settings.setHiddenFiles(patterns),
      'hiddenFiles.getProject': ({ projectId }) => this.projects.getHiddenFiles(projectId),
      'hiddenFiles.setProject': ({ projectId, patterns }) =>
        this.projects.setHiddenFiles(projectId, patterns),
    };
  }
}
