import type { HandlerMap } from '../registry';
import { connectivity } from '../../di';

export const connectivityHandlers: Pick<HandlerMap, 'connectivity.get'> = {
  'connectivity.get': () => ({ offline: connectivity.isOffline() }),
};
