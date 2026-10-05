import type { HandlerMap } from '../registry';
import type { LaunchService } from '../../services/launch';

export function createLaunchHandlers(
  launch: LaunchService,
): Pick<HandlerMap, 'app.launchProject' | 'app.launchDetached'> {
  return {
    'app.launchProject': () => launch.project(),
    'app.launchDetached': ({ projectId }) => launch.launchDetached(projectId),
  };
}
