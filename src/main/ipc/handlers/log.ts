import type { HandlerMap } from '../registry';
import { log, logFilePath } from '../../log';
import { oneLine } from '../../helpers/string';

export class LogHandlers {
  toHandlerMap(): Pick<HandlerMap, 'log.write' | 'log.getPath'> {
    return {
      'log.write': ({ level, scope, message }) => {
        log[level](`renderer:${oneLine(scope)}`, oneLine(message));
      },
      'log.getPath': () => logFilePath(),
    };
  }
}
