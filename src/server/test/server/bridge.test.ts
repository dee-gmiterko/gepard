import { describe, expect, it } from 'vitest';
import type { Envelope } from '@gepard/common';
import { serveIpcSocket, type IpcSocket } from '../../server/bridge';

interface FakeSocket extends IpcSocket {
  sent: string[];
  closed: { code: number; reason: string } | null;
  receive(text: string): void;
  disconnect(): void;
}

function fakeSocket(): FakeSocket {
  const messageListeners: ((text: string) => void)[] = [];
  const closeListeners: (() => void)[] = [];
  const socket: FakeSocket = {
    sent: [],
    closed: null,
    send: (text) => socket.sent.push(text),
    close: (code, reason) => {
      socket.closed = { code, reason };
    },
    onMessage: (cb) => {
      messageListeners.push(cb);
      return () => undefined;
    },
    onClose: (cb) => {
      closeListeners.push(cb);
      return () => undefined;
    },
    receive: (text) => messageListeners.forEach((cb) => cb(text)),
    disconnect: () => closeListeners.forEach((cb) => cb()),
  };
  return socket;
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('serveIpcSocket', () => {
  it('dispatches invokes and answers with the envelope under the same id', async () => {
    const socket = fakeSocket();
    const calls: { channel: string; input: unknown }[] = [];
    serveIpcSocket(
      socket,
      (channel, input) => {
        calls.push({ channel, input });
        return Promise.resolve({ ok: true, value: `${channel}!` });
      },
      () => () => undefined,
    );
    socket.receive(JSON.stringify({ type: 'invoke', id: 7, channel: 'log.getPath' }));
    socket.receive(JSON.stringify({ type: 'invoke', id: 8, channel: 'x.y', input: { a: 1 } }));
    await flush();
    expect(calls).toEqual([
      { channel: 'log.getPath', input: undefined },
      { channel: 'x.y', input: { a: 1 } },
    ]);
    expect(socket.sent.map((text: string): unknown => JSON.parse(text))).toEqual([
      { type: 'result', id: 7, envelope: { ok: true, value: 'log.getPath!' } },
      { type: 'result', id: 8, envelope: { ok: true, value: 'x.y!' } },
    ]);
  });

  it('forwards pushed events while connected and unsubscribes on close', () => {
    const socket = fakeSocket();
    const sinks: ((event: string, payload: unknown) => void)[] = [];
    let unsubscribed = 0;
    serveIpcSocket(
      socket,
      () => Promise.resolve({ ok: true, value: undefined }),
      (next) => {
        sinks.push(next);
        return () => unsubscribed++;
      },
    );
    expect(sinks).toHaveLength(1);
    sinks[0]('clone.progress', { projectId: 'p', phase: 'done', percent: 100 });
    expect(socket.sent.map((text: string): unknown => JSON.parse(text))).toEqual([
      {
        type: 'event',
        event: 'clone.progress',
        payload: { projectId: 'p', phase: 'done', percent: 100 },
      },
    ]);
    socket.disconnect();
    expect(unsubscribed).toBe(1);
  });

  it('drops results that complete after the socket closed', async () => {
    const socket = fakeSocket();
    const settlers: ((envelope: Envelope<unknown>) => void)[] = [];
    serveIpcSocket(
      socket,
      () => new Promise((resolve) => settlers.push(resolve)),
      () => () => undefined,
    );
    socket.receive(JSON.stringify({ type: 'invoke', id: 1, channel: 'log.getPath' }));
    socket.disconnect();
    expect(settlers).toHaveLength(1);
    settlers[0]({ ok: true, value: 'late' });
    await flush();
    expect(socket.sent).toEqual([]);
  });

  it('closes the socket on a malformed message', () => {
    const socket = fakeSocket();
    serveIpcSocket(
      socket,
      () => Promise.resolve({ ok: true, value: undefined }),
      () => () => undefined,
    );
    socket.receive('not json');
    expect(socket.closed?.code).toBe(1003);
    socket.receive(JSON.stringify({ type: 'invoke', id: -1, channel: 'log.getPath' }));
    expect(socket.sent).toEqual([]);
  });
});
