import type { HandlerMap } from '../registry'
import { log } from '../../log'

export const logHandlers: Pick<HandlerMap, 'log.write'> = {
  'log.write': ({ level, scope, message }) => {
    log[level](`renderer:${scope}`, message)
  }
}
