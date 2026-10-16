import { NewWindowUnavailableError } from '@gepard/common';
import type { HandlerMap } from '../dispatch';
import type { LaunchService } from '../../services/launch';

export class LaunchHandlers {
  constructor(private readonly launch: LaunchService) {}

  toHandlerMap(): Pick<HandlerMap, 'app.launch' | 'app.startup'> {
    return {
      'app.launch': (input, { remote }) => {
        if (remote && input.detached) throw new NewWindowUnavailableError();
        return this.launch.launch(input);
      },
      'app.startup': () => this.launch.startup(),
    };
  }
}
