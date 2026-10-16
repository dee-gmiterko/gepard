import { ConnectionError } from '@gepard/common';
import type { IpcEventService } from '../ipc/events';
import type { LoggerService } from '../main/log';

export interface RemoteObserver {
  onRemoteResult(ok: boolean, error?: unknown): void;
}

export class ConnectivityService implements RemoteObserver {
  private offline = false;

  constructor(
    private readonly logger: LoggerService,
    private readonly events: IpcEventService,
  ) {}

  isOffline(): boolean {
    return this.offline;
  }

  private setOffline(offline: boolean, reason?: string): void {
    if (this.offline === offline) return;
    this.offline = offline;
    this.logger.warn('connectivity', offline ? `offline: ${reason ?? 'unknown'}` : 'back online');
    this.events.emit('connectivity.changed', { offline });
  }

  onRemoteResult(ok: boolean, error?: unknown): void {
    if (ok) this.setOffline(false);
    else if (error instanceof ConnectionError) this.setOffline(true, error.message);
  }
}
