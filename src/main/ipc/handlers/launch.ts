import type { HandlerMap } from '../registry';
import type { LaunchService } from '../../services/launch';

export class LaunchHandlers {
  constructor(private readonly launch: LaunchService) {}

  toHandlerMap(): Pick<HandlerMap, 'app.launch' | 'app.startup'> {
    return {
      'app.launch': (input) => this.launch.launch(input),
      'app.startup': () => this.launch.startup(),
    };
  }
}
