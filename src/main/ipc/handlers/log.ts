import type { HandlerMap } from '../registry';
import { log } from '../../log';
import { oneLine } from '../../helpers/string';

export const logHandlers: Pick<HandlerMap, 'log.write'> = {
  'log.write': ({ level, scope, message }) => {
    log[level](`renderer:${oneLine(scope)}`, oneLine(message));
  },
};
