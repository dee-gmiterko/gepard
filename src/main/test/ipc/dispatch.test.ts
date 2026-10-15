import { describe, expect, it } from 'vitest';
import { AppError } from '@gepard/common';
import { createDispatcher, dispatchChannel, type HandlerMap } from '../../ipc/dispatch';

/* eslint-disable @typescript-eslint/consistent-type-assertions -- partial handler map */
const handlers = {
  'log.getPath': () => '/tmp/main.log',
  'theme.setTemplateId': ({ templateId }) => templateId,
  'projects.remove': () => {
    throw new AppError('PROJECT_NOT_FOUND', 'no such project');
  },
  'connectivity.get': () => {
    throw new TypeError('boom');
  },
} satisfies Partial<HandlerMap> as unknown as HandlerMap;
/* eslint-enable @typescript-eslint/consistent-type-assertions */

const ctx = { window: null, remote: false };

describe('dispatchChannel', () => {
  it('validates the input against the contract and runs the handler', async () => {
    await expect(dispatchChannel(handlers, 'log.getPath', undefined, ctx)).resolves.toEqual({
      ok: true,
      value: '/tmp/main.log',
    });
    await expect(
      dispatchChannel(handlers, 'theme.setTemplateId', { templateId: 'dark' }, ctx),
    ).resolves.toEqual({ ok: true, value: 'dark' });
  });

  it('rejects invalid input with BAD_INPUT before touching the handler', async () => {
    const result = await dispatchChannel(handlers, 'theme.setTemplateId', { templateId: 3 }, ctx);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('BAD_INPUT');
  });

  it('serializes AppErrors and wraps unknown errors', async () => {
    await expect(
      dispatchChannel(handlers, 'projects.remove', { projectId: 'a__b' }, ctx),
    ).resolves.toEqual({
      ok: false,
      error: { kind: 'AppError', code: 'PROJECT_NOT_FOUND', message: 'no such project' },
    });
    await expect(dispatchChannel(handlers, 'connectivity.get', undefined, ctx)).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'boom' },
    });
  });
});

describe('createDispatcher', () => {
  it('answers unknown channel names with UNKNOWN_CHANNEL', async () => {
    const dispatch = createDispatcher(handlers, ctx);
    await expect(dispatch('nope.nothing', undefined)).resolves.toEqual({
      ok: false,
      error: { code: 'UNKNOWN_CHANNEL', message: 'Unknown IPC channel: nope.nothing' },
    });
    await expect(dispatch('log.getPath', undefined)).resolves.toEqual({
      ok: true,
      value: '/tmp/main.log',
    });
  });
});
