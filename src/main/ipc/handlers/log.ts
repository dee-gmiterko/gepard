import type { HandlerMap } from '../dispatch';
import type { LoggerService } from '../../main/log';
import { oneLine } from '../../helpers/string';

export class LogHandlers {
  constructor(private readonly logger: LoggerService) {}

  toHandlerMap(): Pick<HandlerMap, 'log.write' | 'log.getPath'> {
    return {
      'log.write': ({ level, scope, message }) => {
        this.logger[level](`renderer:${oneLine(scope)}`, oneLine(message));
      },
      'log.getPath': () => this.logger.filePath(),
    };
  }
}
