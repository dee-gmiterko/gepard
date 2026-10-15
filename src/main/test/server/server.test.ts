import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createIpcServer } from '../../server/server';

class Client {
  private readonly messages: string[] = [];
  private waiters: ((text: string) => void)[] = [];
  readonly ws: WebSocket;
  readonly status: Promise<number>;
  readonly closed: Promise<{ code: number; reason: string }>;

  constructor(port: number, path: string) {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    this.status = new Promise((resolve) => {
      this.ws.on('upgrade', (res) => resolve(res.statusCode ?? 0));
      this.ws.on('unexpected-response', (_req, res) => {
        resolve(res.statusCode ?? 0);
        this.ws.terminate();
      });
    });
    this.closed = new Promise((resolve) => {
      this.ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() }));
    });
    this.ws.on('error', () => undefined);
    this.ws.on('message', (data, isBinary) => {
      if (isBinary || !Buffer.isBuffer(data)) return;
      const text = data.toString();
      const waiter = this.waiters.shift();
      if (waiter) waiter(text);
      else this.messages.push(text);
    });
  }

  open(): Promise<void> {
    return new Promise((resolve) => this.ws.once('open', resolve));
  }

  send(data: string | Buffer): void {
    this.ws.send(data);
  }

  next(): Promise<unknown> {
    const parse = (text: string): unknown => JSON.parse(text);
    const queued = this.messages.shift();
    if (queued !== undefined) return Promise.resolve(parse(queued));
    return new Promise((resolve) => this.waiters.push((text) => resolve(parse(text))));
  }
}

async function until(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !condition(); i++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  expect(condition()).toBe(true);
}

describe('createIpcServer', () => {
  let server: Server;
  let port: number;
  const sinks = new Set<(event: string, payload: unknown) => void>();
  let connections = 0;

  beforeAll(async () => {
    server = createIpcServer(createServer(), {
      serveStatic: (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' }).end('static');
      },
      dispatch: (channel, input) =>
        Promise.resolve(
          channel === 'echo'
            ? { ok: true, value: input }
            : { ok: false, error: { code: 'UNKNOWN_CHANNEL', message: channel } },
        ),
      subscribe: (sink) => {
        sinks.add(sink);
        return () => sinks.delete(sink);
      },
      onConnection: () => connections++,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (address === null || typeof address === 'string') throw new Error('no port');
    port = address.port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves static files and upgrades /ipc on the same port', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/anything`);
    expect(await res.text()).toBe('static');

    const client = new Client(port, '/ipc');
    await client.open();
    await expect(client.status).resolves.toBe(101);
    expect(connections).toBe(1);

    client.send(JSON.stringify({ type: 'invoke', id: 1, channel: 'echo', input: { n: 2 } }));
    await expect(client.next()).resolves.toEqual({
      type: 'result',
      id: 1,
      envelope: { ok: true, value: { n: 2 } },
    });
    client.send(JSON.stringify({ type: 'invoke', id: 2, channel: 'nope' }));
    await expect(client.next()).resolves.toEqual({
      type: 'result',
      id: 2,
      envelope: { ok: false, error: { code: 'UNKNOWN_CHANNEL', message: 'nope' } },
    });

    client.send(Buffer.from([0, 1, 2]));
    client.send(JSON.stringify({ type: 'invoke', id: 3, channel: 'echo', input: 'after binary' }));
    await expect(client.next()).resolves.toEqual({
      type: 'result',
      id: 3,
      envelope: { ok: true, value: 'after binary' },
    });

    expect(sinks.size).toBe(1);
    for (const sink of sinks) sink('app.error', { scope: 's', message: 'm' });
    await expect(client.next()).resolves.toEqual({
      type: 'event',
      event: 'app.error',
      payload: { scope: 's', message: 'm' },
    });

    client.ws.close();
    await client.closed;
    await until(() => sinks.size === 0);
  });

  it('closes the socket with 1003 on a malformed message', async () => {
    const client = new Client(port, '/ipc');
    await client.open();
    client.send('not json');
    await expect(client.closed).resolves.toEqual({ code: 1003, reason: 'malformed ipc message' });
    await until(() => sinks.size === 0);
  });

  it('rejects upgrades on other paths', async () => {
    const client = new Client(port, '/other');
    await expect(client.status).resolves.toBe(404);
    await client.closed;
  });
});
