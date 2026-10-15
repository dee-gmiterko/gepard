import type { RawData, WebSocket } from 'ws';
import { parseSocketClientMessage, serializeEvent, serializeResult } from '@gepard/common';
import type { Dispatcher } from '../ipc/dispatch';

const CLOSE_UNSUPPORTED_DATA = 1003;

export interface IpcSocket {
  send(text: string): void;
  close(code: number, reason: string): void;
  onMessage(cb: (text: string) => void): () => void;
  onClose(cb: () => void): () => void;
}

export type EventSubscribe = (sink: (event: string, payload: unknown) => void) => () => void;

function textOf(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString();
  if (Array.isArray(data)) return Buffer.concat(data).toString();
  return Buffer.from(data).toString();
}

export function fromWebSocket(ws: WebSocket): IpcSocket {
  ws.on('error', () => undefined);
  return {
    send: (text) => ws.send(text),
    close: (code, reason) => ws.close(code, reason),
    onMessage: (cb) => {
      const listener = (data: RawData, isBinary: boolean): void => {
        if (!isBinary) cb(textOf(data));
      };
      ws.on('message', listener);
      return () => ws.off('message', listener);
    },
    onClose: (cb) => {
      ws.on('close', cb);
      return () => ws.off('close', cb);
    },
  };
}

export function serveIpcSocket(
  socket: IpcSocket,
  dispatch: Dispatcher,
  subscribe: EventSubscribe,
): void {
  let open = true;
  socket.onMessage((text) => {
    const message = parseSocketClientMessage(text);
    if (message === null) {
      socket.close(CLOSE_UNSUPPORTED_DATA, 'malformed ipc message');
      return;
    }
    void dispatch(message.channel, message.input).then((envelope) => {
      if (open) socket.send(serializeResult(message.id, envelope));
    });
  });
  const unsubscribe = subscribe((event, payload) => socket.send(serializeEvent(event, payload)));
  socket.onClose(() => {
    open = false;
    unsubscribe();
  });
}
