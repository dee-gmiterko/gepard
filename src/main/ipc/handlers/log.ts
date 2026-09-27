import type { HandlerMap } from '../registry'
import { log } from '../../log'

// The renderer's `scope`/`message` are untrusted input; a line break would
// let one log.write call forge additional log lines.
function oneLine(value: string): string {
  return value.replace(/\r\n|\r|\n/g, ' ')
}

export const logHandlers: Pick<HandlerMap, 'log.write'> = {
  'log.write': ({ level, scope, message }) => {
    log[level](`renderer:${oneLine(scope)}`, oneLine(message))
  }
}
