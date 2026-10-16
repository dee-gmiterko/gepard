import { run, runBuffer, runJson } from '../../helpers/process/exec';
import { GitClient } from '../../clients/git';
import { GhClient } from '../../clients/gh';
import { GitService } from '../../services/git';
import { GhService } from '../../services/gh';
import { ConnectivityService } from '../../services/connectivity';
import { FileLockService } from '../../services/fileLock';
import { IpcEventService } from '../../ipc/events';
import { ProjectStore } from '../../store/projects';
import type { Paths } from '../../paths';
import { silentLogger } from './tmp';

export interface GitFixtureServices {
  events: IpcEventService;
  projects: ProjectStore;
  git: GitService;
  gh: GhService;
}

export function makeGitServices(paths: Paths): GitFixtureServices {
  const events = new IpcEventService();
  const connectivity = new ConnectivityService(silentLogger, events);
  const projects = new ProjectStore(paths, silentLogger, new FileLockService());
  const git = new GitService(
    paths,
    silentLogger,
    events,
    { onCheckout: () => undefined },
    new GitClient(connectivity, run, runBuffer),
    projects,
  );
  const gh = new GhService(new GhClient(connectivity, run, runJson), projects);
  return { events, projects, git, gh };
}
