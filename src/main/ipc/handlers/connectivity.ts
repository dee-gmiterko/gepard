import type { HandlerMap } from '../registry';
import type { ConnectivityService } from '../../services/connectivity';

export class ConnectivityHandlers {
  constructor(private readonly connectivity: ConnectivityService) {}

  toHandlerMap(): Pick<HandlerMap, 'connectivity.get'> {
    return { 'connectivity.get': () => ({ offline: this.connectivity.isOffline() }) };
  }
}
