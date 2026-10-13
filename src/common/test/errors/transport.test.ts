import { describe, expect, it } from 'vitest';
import {
  AbortError,
  AppError,
  AuthError,
  ConnectionError,
  ExecExitError,
  IpcError,
  MissingDependencyError,
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

  it('recognizes a known kind thrown by another copy of this package', () => {
    const foreign = Object.assign(new Error('godot: not found'), {
      name: 'MissingDependencyError',
      code: 'MISSING_DEPENDENCY',
      details: { dependency: 'godot' },
    });
    expect(toIpcErrorShape(foreign)).toEqual({
      kind: 'MissingDependencyError',
      code: 'MISSING_DEPENDENCY',
      message: 'godot: not found',
      details: { dependency: 'godot' },
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
    [new MissingDependencyError('java'), MissingDependencyError],
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

  it('rebuilds a missing dependency with the dependency it names', () => {
    const rebuilt = fromIpcErrorShape(toIpcErrorShape(new MissingDependencyError('java')), 'x');
    expect(rebuilt).toBeInstanceOf(MissingDependencyError);
    expect(rebuilt).toMatchObject({
      dependency: 'java',
      code: 'MISSING_DEPENDENCY',
      message: 'java: not found',
    });
  });

  it('falls back to IpcError for a missing dependency shape without details', () => {
    const rebuilt = fromIpcErrorShape(
      { kind: 'MissingDependencyError', code: 'MISSING_DEPENDENCY', message: 'gone' },
      'x',
    );
    expect(rebuilt).toBeInstanceOf(IpcError);
    expect(rebuilt).toMatchObject({ code: 'MISSING_DEPENDENCY', message: 'gone' });
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
