import type { HandlerMap } from '../registry';
import type { LaunchService } from '../../services/launch';

export function createLaunchHandlers(launch: LaunchService): Pick<HandlerMap, 'app.launch'> {
  return {
    'app.launch': (input) =>
      input.detached ? launch.launchDetached(input.projectId) : launch.project(),
  };
}
