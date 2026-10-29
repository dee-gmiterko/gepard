import type { HandlerMap } from '../dispatch';
import type { ProjectStore } from '../../store/projects';
import type { SettingsStore } from '../../store/settings';

export class HiddenFilesHandlers {
  constructor(
    private readonly settings: SettingsStore,
    private readonly projects: ProjectStore,
  ) {}

  toHandlerMap(): Pick<HandlerMap, 'hiddenFiles.get' | 'hiddenFiles.set'> {
    return {
      'hiddenFiles.get': (target) =>
        target.scope === 'global'
          ? this.settings.getHiddenFiles()
          : this.projects.getHiddenFiles(target.projectId),
      'hiddenFiles.set': (input) =>
        input.scope === 'global'
          ? this.settings.setHiddenFiles(input.patterns)
          : this.projects.setHiddenFiles(input.projectId, input.patterns),
    };
  }
}
