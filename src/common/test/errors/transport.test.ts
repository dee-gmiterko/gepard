import { describe, expect, it } from 'vitest';
import {
  AbortError,
  AppError,
  AuthError,
  ConnectionError,
  ExecExitError,
  IpcError,
  RateLimitError,
  RemoteNotFoundError,
  StaleShaError,
  fromIpcErrorShape,
  toIpcErrorShape,
} from '../../errors';

describe('toIpcErrorShape', () => {
  it('carries the class name of an AppError as its kind', () => {
    const error = new ConnectionError('offline', { cmd: 'gh' });
    expect(toIpcErrorShape(error)).toEqual({
      kind: 'ConnectionError',
      code: 'CONNECTION_FAILED',
      message: 'offline',
      details: { cmd: 'gh' },
    });
  });

  it('maps a foreign AbortError to CANCELLED', () => {
    const native = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(toIpcErrorShape(native)).toEqual({
      kind: 'AbortError',
      code: 'CANCELLED',
      message: 'aborted',
    });
  });

  it('maps anything else to INTERNAL', () => {
    expect(toIpcErrorShape(new Error('boom'))).toEqual({ code: 'INTERNAL', message: 'boom' });
    expect(toIpcErrorShape('boom')).toEqual({ code: 'INTERNAL', message: 'boom' });
  });
});

describe('fromIpcErrorShape', () => {
  it.each([
    [new AbortError('cancelled'), AbortError],
    [new AuthError('login'), AuthError],
    [new ConnectionError('offline'), ConnectionError],
    [new RateLimitError('slow down'), RateLimitError],
    [new RemoteNotFoundError('gone'), RemoteNotFoundError],
    [new StaleShaError('moved'), StaleShaError],
  ])('rebuilds %o as the class that was thrown', (thrown, cls) => {
    const rebuilt = fromIpcErrorShape(toIpcErrorShape(thrown), 'pr.list');
    expect(rebuilt).toBeInstanceOf(cls);
    expect(rebuilt).toBeInstanceOf(AppError);
    expect(rebuilt).toMatchObject({
      code: thrown.code,
      message: thrown.message,
      channel: 'pr.list',
    });
  });

  it('keeps the details of a rebuilt error', () => {
    const shape = toIpcErrorShape(new ConnectionError('offline', { cmd: 'git' }));
    expect(fromIpcErrorShape(shape, 'projects.fetch').details).toEqual({ cmd: 'git' });
  });

  it('falls back to IpcError for every other kind', () => {
    const exec = fromIpcErrorShape(
      toIpcErrorShape(new ExecExitError('gh', [], 1, null, 'boom')),
      'pr.list',
    );
    expect(exec).toBeInstanceOf(IpcError);
    expect(exec).toMatchObject({ code: 'EXEC_FAILED', channel: 'pr.list' });

    const internal = fromIpcErrorShape({ code: 'INTERNAL', message: 'boom' }, 'pr.list');
    expect(internal).toBeInstanceOf(IpcError);
    expect(internal).not.toBeInstanceOf(ConnectionError);
  });
});
