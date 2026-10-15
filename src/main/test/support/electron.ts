import { addEventSink } from '../../ipc/registry';
import { setUserDataDir } from '../../paths';

export interface EmittedEvent {
  channel: string;
  payload: unknown;
}

export const emittedEvents: EmittedEvent[] = [];

addEventSink((channel, payload) => {
  emittedEvents.push({ channel, payload });
});

export function __setUserDataDir(dir: string): void {
  setUserDataDir(dir);
}

export function __clearEmittedEvents(): void {
  emittedEvents.length = 0;
}
