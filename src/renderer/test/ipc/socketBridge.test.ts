import { describe, expect, it } from 'vitest';
import { createSocketBridge, socketUrl, type BridgeSocket } from '../../src/ipc/socketBridge';

class FakeSocket implements BridgeSocket {
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, ((event: { data: unknown }) => void)[]>();

  send(data: string): void {
    this.sent.push(data);
  }

  addEventListener(type: string, listener: (event: { data: unknown }) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  open(): void {
    for (const cb of this.listeners.get('open') ?? []) cb({ data: undefined });
  }

  receive(message: unknown): void {
    for (const cb of this.listeners.get('message') ?? []) cb({ data: JSON.stringify(message) });
  }

  drop(): void {
    for (const cb of this.listeners.get('close') ?? []) cb({ data: undefined });
  }

  lastSent(): unknown {
    const parsed: unknown = JSON.parse(this.sent[this.sent.length - 1]);
    return parsed;
  }
}

function harness(): {
  sockets: FakeSocket[];
  timers: { cb: () => void; delayMs: number }[];
  bridge: ReturnType<typeof createSocketBridge>;
} {
  const sockets: FakeSocket[] = [];
  const timers: { cb: () => void; delayMs: number }[] = [];
  const bridge = createSocketBridge('ws://host/ipc', {
    connect: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    schedule: (cb, delayMs) => timers.push({ cb, delayMs }),
    initialRetryMs: 100,
    maxRetryMs: 250,
  });
  return { sockets, timers, bridge };
}

describe('socketUrl', () => {
  it('targets /ipc on the serving origin', () => {
    expect(socketUrl({ protocol: 'http:', host: 'localhost:8080' })).toBe(
      'ws://localhost:8080/ipc',
    );
    expect(socketUrl({ protocol: 'https:', host: 'gepard.example' })).toBe(
      'wss://gepard.example/ipc',
    );
  });
});

describe('createSocketBridge', () => {
  it('connects eagerly and queues invokes until the socket opens', async () => {
    const { sockets, bridge } = harness();
    expect(sockets).toHaveLength(1);
    const socket = sockets[0];
    const result = bridge.invoke('log.getPath', undefined);
    expect(socket.sent).toEqual([]);
    socket.open();
    expect(socket.lastSent()).toEqual({ type: 'invoke', id: 1, channel: 'log.getPath' });
    socket.receive({ type: 'result', id: 1, envelope: { ok: true, value: '/log' } });
    await expect(result).resolves.toEqual({ ok: true, value: '/log' });
  });

  it('correlates results by id and passes error envelopes through', async () => {
    const { sockets, bridge } = harness();
    const socket = sockets[0];
    socket.open();
    const first = bridge.invoke('app.viewer', undefined);
    const second = bridge.invoke('projects.list', undefined);
    socket.receive({ type: 'result', id: 2, envelope: { ok: true, value: [] } });
    socket.receive({
      type: 'result',
      id: 1,
      envelope: { ok: false, error: { code: 'AUTH', message: 'no' } },
    });
    await expect(second).resolves.toEqual({ ok: true, value: [] });
    await expect(first).resolves.toEqual({ ok: false, error: { code: 'AUTH', message: 'no' } });
  });

  it('delivers events to subscribers until they unsubscribe', () => {
    const { sockets, bridge } = harness();
    const socket = sockets[0];
    socket.open();
    const seen: unknown[] = [];
    const off = bridge.on('app.error', (payload) => seen.push(payload));
    socket.receive({ type: 'event', event: 'app.error', payload: { scope: 's', message: 'm' } });
    socket.receive({ type: 'event', event: 'connectivity.changed', payload: { offline: true } });
    off();
    socket.receive({ type: 'event', event: 'app.error', payload: { scope: 's', message: 'x' } });
    expect(seen).toEqual([{ scope: 's', message: 'm' }]);
  });

  it('fails in-flight invokes on disconnect and reconnects with backoff', async () => {
    const { sockets, timers, bridge } = harness();
    const socket = sockets[0];
    socket.open();
    const pending = bridge.invoke('log.getPath', undefined);
    socket.drop();
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: { kind: 'ConnectionError', code: 'CONNECTION_FAILED' },
    });
    expect(timers.map((t) => t.delayMs)).toEqual([100]);
    timers[0].cb();
    expect(sockets).toHaveLength(2);
    sockets[1].drop();
    timers[1].cb();
    sockets[2].drop();
    expect(timers.map((t) => t.delayMs)).toEqual([100, 200, 250]);
    timers[2].cb();
    sockets[3].open();
    const after = bridge.invoke('log.getPath', undefined);
    sockets[3].receive({ type: 'result', id: 2, envelope: { ok: true, value: '/log' } });
    await expect(after).resolves.toEqual({ ok: true, value: '/log' });
  });

  it('ignores stale sockets and malformed frames', async () => {
    const { sockets, timers, bridge } = harness();
    const socket = sockets[0];
    socket.open();
    socket.receive('garbage');
    socket.drop();
    timers[0].cb();
    const next = sockets[1];
    next.open();
    const result = bridge.invoke('log.getPath', undefined);
    socket.receive({ type: 'result', id: 1, envelope: { ok: true, value: 'stale' } });
    next.receive({ type: 'result', id: 1, envelope: { ok: true, value: 'fresh' } });
    await expect(result).resolves.toEqual({ ok: true, value: 'fresh' });
  });
});
