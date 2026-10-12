import type { RemoteObserver } from '../clients/remote';
import { toConnectionError } from '../helpers/process/connection';
import { emit } from '../ipc/registry';
import { log } from '../log';

export class ConnectivityService implements RemoteObserver {
  private offline = false;

  constructor(
    private readonly publish: (offline: boolean) => void = (offline) =>
      emit('connectivity.changed', { offline }),
  ) {}

  isOffline(): boolean {
    return this.offline;
  }

  private setOffline(offline: boolean, reason?: string): void {
    if (this.offline === offline) return;
    this.offline = offline;
    log.warn('connectivity', offline ? `offline: ${reason ?? 'unknown'}` : 'back online');
    this.publish(offline);
  }

  onRemoteResult(ok: boolean, error?: unknown): void {
    if (ok) {
      this.setOffline(false);
      return;
    }
    const failure = toConnectionError(error);
    if (failure !== null) this.setOffline(true, failure.message);
  }
}

export const connectivity = new ConnectivityService();
