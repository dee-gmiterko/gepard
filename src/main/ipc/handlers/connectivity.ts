import type { HandlerMap } from '../registry';
import { connectivity } from '../../services/connectivity';

export const connectivityHandlers: Pick<HandlerMap, 'connectivity.get'> = {
  'connectivity.get': () => ({ offline: connectivity.isOffline() }),
};
