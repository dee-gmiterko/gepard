// `webContents.send` reaches only windows that already exist and have
// registered a listener; it does not queue messages.
import type { LogLevel } from '@gepard/common';
import type { IpcEventService } from '../ipc/events';
import type { LoggerService } from './log';

export interface AppErrorPayload {
  scope: string;
  message: string;
}

export class AppErrorGate {
  private ready = false;
  private pending: AppErrorPayload[] = [];

  notify(payload: AppErrorPayload): AppErrorPayload[] {
    if (this.ready) return [payload];
    this.pending.push(payload);
    return [];
  }

  open(): AppErrorPayload[] {
    if (this.ready) return [];
    this.ready = true;
    return this.pending.splice(0);
  }
}

export function isNotifiableLevel(level: LogLevel): boolean {
  return level === 'error';
}

export class NotifyService {
  private readonly gate = new AppErrorGate();

  constructor(
    private readonly logger: LoggerService,
    private readonly events: IpcEventService,
  ) {}

  mainFailure(scope: string, message: string): void {
    this.logger.error(scope, message);
    for (const payload of this.gate.notify({ scope, message }))
      this.events.emit('app.error', payload);
  }

  rendererReady(): void {
    for (const payload of this.gate.open()) this.events.emit('app.error', payload);
  }
}
