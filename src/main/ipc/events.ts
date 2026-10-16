import type { EventName, EventPayload } from '@gepard/common';

export type EventSink = (name: EventName, payload: unknown) => void;

export class IpcEventService {
  private readonly sinks = new Set<EventSink>();

  subscribe(sink: EventSink): () => void {
    this.sinks.add(sink);
    return () => {
      this.sinks.delete(sink);
    };
  }

  emit<E extends EventName>(name: E, payload: EventPayload<E>): void {
    for (const sink of this.sinks) sink(name, payload);
  }
}
