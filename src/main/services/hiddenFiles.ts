import {
  compileHiddenPatterns,
  filterHiddenPaths,
  mergeHiddenPatterns,
} from '../helpers/hiddenFiles';
import type { ProjectStore } from '../store/projects';
import type { SettingsStore } from '../store/settings';

export interface HiddenFilesFilter {
  filter<T>(projectId: string, items: readonly T[], pathOf: (item: T) => string): Promise<T[]>;
}

export class HiddenFilesService implements HiddenFilesFilter {
  constructor(
    private readonly settings: Pick<SettingsStore, 'getHiddenFiles'>,
    private readonly projects: Pick<ProjectStore, 'getHiddenFiles'>,
  ) {}

  async filter<T>(
    projectId: string,
    items: readonly T[],
    pathOf: (item: T) => string,
  ): Promise<T[]> {
    const [globalPatterns, projectPatterns] = await Promise.all([
      this.settings.getHiddenFiles(),
      this.projects.getHiddenFiles(projectId),
    ]);
    const patterns = compileHiddenPatterns(mergeHiddenPatterns(globalPatterns, projectPatterns));
    return filterHiddenPaths(items, patterns, pathOf);
  }
}
