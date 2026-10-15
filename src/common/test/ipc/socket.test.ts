import { describe, expect, it } from 'vitest';
import {
  parseSocketClientMessage,
  parseSocketServerMessage,
  serializeEvent,
  serializeInvoke,
  serializeResult,
} from '../../ipc/socket';

describe('socket client messages', () => {
  it('round-trips an invoke, dropping an undefined input', () => {
    expect(parseSocketClientMessage(serializeInvoke(3, 'log.getPath', undefined))).toEqual({
      type: 'invoke',
      id: 3,
      channel: 'log.getPath',
    });
    expect(parseSocketClientMessage(serializeInvoke(4, 'pr.view', { n: 1 }))).toEqual({
      type: 'invoke',
      id: 4,
      channel: 'pr.view',
      input: { n: 1 },
    });
  });

  it('rejects malformed text and shapes', () => {
    expect(parseSocketClientMessage('{')).toBeNull();
    expect(parseSocketClientMessage('"string"')).toBeNull();
    expect(parseSocketClientMessage(JSON.stringify({ type: 'result', id: 1 }))).toBeNull();
    expect(
      parseSocketClientMessage(JSON.stringify({ type: 'invoke', id: 1.5, channel: 'a' })),
    ).toBeNull();
    expect(
      parseSocketClientMessage(JSON.stringify({ type: 'invoke', id: 1, channel: '' })),
    ).toBeNull();
  });
});

describe('socket server messages', () => {
  it('round-trips results including void values and errors', () => {
    expect(parseSocketServerMessage(serializeResult(1, { ok: true, value: undefined }))).toEqual({
      type: 'result',
      id: 1,
      envelope: { ok: true, value: undefined },
    });
    expect(parseSocketServerMessage(serializeResult(2, { ok: true, value: [1, 'a'] }))).toEqual({
      type: 'result',
      id: 2,
      envelope: { ok: true, value: [1, 'a'] },
    });
    const error = { kind: 'AppError', code: 'X', message: 'why', details: { a: 1 } };
    expect(parseSocketServerMessage(serializeResult(3, { ok: false, error }))).toEqual({
      type: 'result',
      id: 3,
      envelope: { ok: false, error },
    });
  });

  it('round-trips events', () => {
    const event = serializeEvent('app.error', { scope: 's', message: 'm' });
    expect(parseSocketServerMessage(event)).toEqual({
      type: 'event',
      event: 'app.error',
      payload: { scope: 's', message: 'm' },
    });
  });

  it('rejects malformed messages', () => {
    expect(parseSocketServerMessage('nope')).toBeNull();
    expect(parseSocketServerMessage(JSON.stringify({ type: 'invoke', id: 1 }))).toBeNull();
    expect(
      parseSocketServerMessage(JSON.stringify({ type: 'result', id: 1, envelope: {} })),
    ).toBeNull();
    expect(
      parseSocketServerMessage(JSON.stringify({ type: 'result', id: 1, envelope: { ok: false } })),
    ).toBeNull();
  });
});
