import type { HandlerMap } from '../registry';
import type { LaunchService } from '../../services/launch';

export function createLaunchHandlers(
  launch: LaunchService,
): Pick<HandlerMap, 'app.launch' | 'app.startup'> {
  return {
    'app.launch': (input) => launch.launch(input),
    'app.startup': () => launch.startup(),
  };
}
