import { ExecExitError } from '@gepard/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { GhClient, type GhExec } from '../../clients/gh';
import type { RemoteObserver } from '../../clients/remote';
import { ConnectionError } from '../../helpers/process/connection';

interface Recorded {
  ok: boolean;
  error?: unknown;
}

interface Spawned {
  cmd: string;
  args: string[];
  opts: { env?: NodeJS.ProcessEnv; timeoutMs?: number; stdin?: string };
}

function recorder(): RemoteObserver & { results: Recorded[] } {
  const results: Recorded[] = [];
  return {
    results,
    onRemoteResult(ok, error) {
      results.push(error === undefined ? { ok } : { ok, error });
    },
  };
}

function fakeExec(stdout: string | Error): GhExec & { spawned: Spawned[] } {
  const spawned: Spawned[] = [];
  const run: GhExec['run'] = (cmd, args, opts = {}) => {
    spawned.push({ cmd, args, opts });
    if (stdout instanceof Error) return Promise.reject(stdout);
    return Promise.resolve({ stdout, stderr: '', exitCode: 0 });
  };
  const runJson: GhExec['runJson'] = async (schema, cmd, args, opts) => {
    const { stdout: text } = await run(cmd, args, opts);
    return schema.parse(JSON.parse(text));
  };
  return { run, runJson, spawned };
}

const offlineFailure = (): ExecExitError =>
  new ExecExitError(
    'gh',
    ['api', 'user'],
    1,
    null,
    'error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com',
  );

describe('GhClient', () => {
  it('spawns gh with a non-interactive environment and the default timeout', async () => {
    const exec = fakeExec('ok');
    const client = new GhClient(recorder(), exec);
    await client.run(['api', 'user']);
    expect(exec.spawned).toHaveLength(1);
    expect(exec.spawned[0].cmd).toBe('gh');
    expect(exec.spawned[0].args).toEqual(['api', 'user']);
    expect(exec.spawned[0].opts.timeoutMs).toBe(30_000);
    expect(exec.spawned[0].opts.env).toMatchObject({ GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat' });
  });

  it('reports a success to the observer', async () => {
    const observer = recorder();
    const client = new GhClient(observer, fakeExec('{"login":"me"}'));
    await expect(client.json(z.object({ login: z.string() }), ['api', 'user'])).resolves.toEqual({
      login: 'me',
    });
    expect(observer.results).toEqual([{ ok: true }]);
  });

  it('translates a connection failure into a ConnectionError and notifies the observer', async () => {
    const observer = recorder();
    const client = new GhClient(observer, fakeExec(offlineFailure()));
    const failure = client.run(['api', 'user']);
    await expect(failure).rejects.toBeInstanceOf(ConnectionError);
    await expect(failure).rejects.toMatchObject({ code: 'CONNECTION_FAILED', cmd: 'gh' });
    expect(observer.results).toHaveLength(1);
    expect(observer.results[0].ok).toBe(false);
    expect(observer.results[0].error).toBeInstanceOf(ConnectionError);
  });

  it('passes other failures through unchanged', async () => {
    const observer = recorder();
    const notFound = new ExecExitError('gh', ['api', 'x'], 1, null, 'gh: Not Found (HTTP 404)');
    const client = new GhClient(observer, fakeExec(notFound));
    await expect(client.run(['api', 'x'])).rejects.toBe(notFound);
    expect(observer.results).toEqual([{ ok: false, error: notFound }]);
  });

  it('sends graphql queries over stdin and surfaces graphql errors', async () => {
    const exec = fakeExec('{"data":null,"errors":[{"message":"nope"}]}');
    const client = new GhClient(recorder(), exec);
    const schema = z.object({
      data: z.unknown(),
      errors: z.array(z.object({ message: z.string() })).optional(),
    });
    await expect(client.graphql(schema, 'query { x }', { a: 1 })).rejects.toMatchObject({
      code: 'GRAPHQL_ERROR',
      message: 'nope',
    });
    expect(exec.spawned[0].args).toEqual(['api', 'graphql', '--input', '-']);
    expect(JSON.parse(exec.spawned[0].opts.stdin ?? '')).toEqual({
      query: 'query { x }',
      variables: { a: 1 },
    });
  });
});
