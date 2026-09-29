import type { HandlerMap } from '../registry';
import { log, logFilePath } from '../../log';
import { oneLine } from '../../helpers/string';

export const logHandlers: Pick<HandlerMap, 'log.write' | 'log.getPath'> = {
  'log.write': ({ level, scope, message }) => {
    log[level](`renderer:${oneLine(scope)}`, oneLine(message));
  },
  'log.getPath': () => logFilePath(),
};
