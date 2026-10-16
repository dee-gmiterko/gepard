import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { WebSocketServer } from 'ws';
import { SOCKET_PATH } from '@gepard/common';
import type { Dispatcher } from '@gepard/main/ipc/dispatch';
import { fromWebSocket, serveIpcSocket, type EventSubscribe } from './bridge';

export interface IpcServerOptions {
  serveStatic: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
  dispatch: Dispatcher;
  subscribe: EventSubscribe;
  onConnection?: () => void;
}

function pathOf(req: IncomingMessage): string {
  return new URL(req.url ?? '/', 'http://localhost').pathname;
}

export function createIpcServer(server: Server, options: IpcServerOptions): Server {
  const wss = new WebSocketServer({ noServer: true });
  server.on('request', (req, res) => void options.serveStatic(req, res));
  server.on('upgrade', (req, socket, head) => {
    if (pathOf(req) !== SOCKET_PATH) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      serveIpcSocket(fromWebSocket(ws), options.dispatch, options.subscribe);
      options.onConnection?.();
    });
  });
  return server;
}
