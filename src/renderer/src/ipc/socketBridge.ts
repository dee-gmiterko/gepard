import {
  type ChannelName,
  type ChannelOutput,
  ConnectionError,
  type Envelope,
  type EventName,
  type EventPayload,
  type IpcBridge,
  parseSocketServerMessage,
  SOCKET_PATH,
  serializeInvoke,
  toIpcErrorShape,
} from '@gepard/common';

export interface BridgeSocket {
  send(data: string): void;
  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void;
  addEventListener(type: 'close', listener: () => void): void;
}

export type BridgeSocketFactory = (url: string) => BridgeSocket;

export interface SocketBridgeOptions {
  connect?: BridgeSocketFactory;
  schedule?: (cb: () => void, delayMs: number) => void;
  initialRetryMs?: number;
  maxRetryMs?: number;
}

const DISCONNECTED: Envelope<never> = {
  ok: false,
  error: toIpcErrorShape(new ConnectionError('The connection to the Gepard server was lost.')),
};

export function socketUrl(location: { protocol: string; host: string }): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${SOCKET_PATH}`;
}

export function createSocketBridge(url: string, options: SocketBridgeOptions = {}): IpcBridge {
  const connect: BridgeSocketFactory = options.connect ?? ((target) => new WebSocket(target));
  const schedule = options.schedule ?? ((cb, delayMs) => setTimeout(cb, delayMs));
  const initialRetryMs = options.initialRetryMs ?? 500;
  const maxRetryMs = options.maxRetryMs ?? 10_000;

  const pending = new Map<number, (envelope: Envelope<unknown>) => void>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let nextId = 1;
  let socket: BridgeSocket | null = null;
  let open = false;
  let queue: string[] = [];
  let retryMs = initialRetryMs;

  function failPending(): void {
    const settle = [...pending.values()];
    pending.clear();
    queue = [];
    for (const resolve of settle) resolve(DISCONNECTED);
  }

  function receive(data: unknown): void {
    if (typeof data !== 'string') return;
    const message = parseSocketServerMessage(data);
    if (message === null) return;
    if (message.type === 'result') {
      const resolve = pending.get(message.id);
      pending.delete(message.id);
      resolve?.(message.envelope);
      return;
    }
    for (const cb of listeners.get(message.event) ?? []) cb(message.payload);
  }

  function connectNow(): void {
    const next = connect(url);
    socket = next;
    next.addEventListener('open', () => {
      if (socket !== next) return;
      open = true;
      retryMs = initialRetryMs;
      for (const text of queue.splice(0)) next.send(text);
    });
    next.addEventListener('message', (event) => {
      if (socket === next) receive(event.data);
    });
    next.addEventListener('close', () => {
      if (socket !== next) return;
      socket = null;
      open = false;
      failPending();
      schedule(() => {
        if (socket === null) connectNow();
      }, retryMs);
      retryMs = Math.min(retryMs * 2, maxRetryMs);
    });
  }

  connectNow();

  return {
    invoke<C extends ChannelName>(channel: C, input: unknown): Promise<Envelope<ChannelOutput<C>>> {
      const id = nextId++;
      const text = serializeInvoke(id, channel, input);
      return new Promise((resolve) => {
        pending.set(id, (envelope) => resolve(envelopeFor<ChannelOutput<C>>(envelope)));
        if (open && socket !== null) socket.send(text);
        else queue.push(text);
      });
    },
    on<E extends EventName>(event: E, cb: (payload: EventPayload<E>) => void): () => void {
      const set = listeners.get(event) ?? new Set();
      listeners.set(event, set);
      const listener = (payload: unknown): void => cb(payloadFor<E>(payload));
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },
  };
}

/* eslint-disable @typescript-eslint/consistent-type-assertions -- validated by the server */
function envelopeFor<T>(envelope: Envelope<unknown>): Envelope<T> {
  return envelope.ok ? { ok: true, value: envelope.value as T } : envelope;
}

function payloadFor<E extends EventName>(payload: unknown): EventPayload<E> {
  return payload as EventPayload<E>;
}
