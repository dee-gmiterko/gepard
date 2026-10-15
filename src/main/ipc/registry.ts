import type { EventName, EventPayload } from '@gepard/common';

export type { Dispatcher, HandlerCtx, HandlerMap } from './dispatch';

export type EventSink = (name: EventName, payload: unknown) => void;

const eventSinks = new Set<EventSink>();

export function addEventSink(sink: EventSink): () => void {
  eventSinks.add(sink);
  return () => {
    eventSinks.delete(sink);
  };
}

export function emit<E extends EventName>(name: E, payload: EventPayload<E>): void {
  for (const sink of eventSinks) sink(name, payload);
}
