import {
  AuthError,
  ConnectionError,
  ExecExitError,
  ExecSpawnError,
  RateLimitError,
  RemoteNotFoundError,
} from '@gepard/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { GhClient } from '../../clients/gh';
import type { run as execRun, runJson as execRunJson } from '../../helpers/process/exec';
import type { RemoteObserver } from '../../services/connectivity';

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

interface GhExec {
  run: typeof execRun;
  runJson: typeof execRunJson;
}

function fakeExec(stdout: string | Error): GhExec & { spawned: Spawned[] } {
  const spawned: Spawned[] = [];
  const run: typeof execRun = (cmd, args, opts = {}) => {
    spawned.push({ cmd, args, opts });
    if (stdout instanceof Error) return Promise.reject(stdout);
    return Promise.resolve({ stdout, stderr: '', exitCode: 0 });
  };
  const runJson: typeof execRunJson = async (schema, cmd, args, opts) => {
    const { stdout: text } = await run(cmd, args, opts);
    return schema.parse(JSON.parse(text));
  };
  return { run, runJson, spawned };
}

function clientOf(observer: RemoteObserver, exec: GhExec): GhClient {
  return new GhClient(observer, exec.run, exec.runJson);
}

function ghFailure(stderr: string): ExecExitError {
  return new ExecExitError('gh', ['api', 'user'], 1, null, stderr);
}

async function failureOf(stderr: string): Promise<unknown> {
  return clientOf(recorder(), fakeExec(ghFailure(stderr)))
    .run(['api', 'user'])
    .then(
      () => undefined,
      (e: unknown) => e,
    );
}

describe('GhClient', () => {
  it('spawns gh with a non-interactive environment and the default timeout', async () => {
    const exec = fakeExec('ok');
    const client = clientOf(recorder(), exec);
    await client.run(['api', 'user']);
    expect(exec.spawned).toHaveLength(1);
    expect(exec.spawned[0].cmd).toBe('gh');
    expect(exec.spawned[0].args).toEqual(['api', 'user']);
    expect(exec.spawned[0].opts.timeoutMs).toBe(30_000);
    expect(exec.spawned[0].opts.env).toMatchObject({ GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat' });
  });

  it('reports a success to the observer', async () => {
    const observer = recorder();
    const client = clientOf(observer, fakeExec('{"login":"me"}'));
    await expect(client.json(z.object({ login: z.string() }), ['api', 'user'])).resolves.toEqual({
      login: 'me',
    });
    expect(observer.results).toEqual([{ ok: true }]);
  });

  it('translates a connection failure into a ConnectionError and notifies the observer', async () => {
    const observer = recorder();
    const cause = ghFailure(
      'error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com',
    );
    const client = clientOf(observer, fakeExec(cause));
    const failure = client.run(['api', 'user']);
    await expect(failure).rejects.toBeInstanceOf(ConnectionError);
    await expect(failure).rejects.toMatchObject({
      code: 'CONNECTION_FAILED',
      message: cause.message,
      details: { cmd: 'gh', args: ['api', 'user'], exitCode: 1, stderr: cause.stderr },
    });
    expect(observer.results).toHaveLength(1);
    expect(observer.results[0].ok).toBe(false);
    expect(observer.results[0].error).toBeInstanceOf(ConnectionError);
  });

  it('passes unrecognised failures through unchanged', async () => {
    const observer = recorder();
    const failure = ghFailure('gh: Resource not accessible by integration (HTTP 403)');
    const client = clientOf(observer, fakeExec(failure));
    await expect(client.run(['api', 'x'])).rejects.toBe(failure);
    expect(observer.results).toEqual([{ ok: false, error: failure }]);
  });

  it('leaves a missing gh binary alone', async () => {
    const spawn = new ExecSpawnError({ code: 'ENOENT', message: 'spawn gh ENOENT' }, 'gh', [], '');
    await expect(clientOf(recorder(), fakeExec(spawn)).run(['api', 'user'])).rejects.toBe(spawn);
  });

  it('sends graphql queries over stdin and surfaces graphql errors', async () => {
    const exec = fakeExec('{"data":null,"errors":[{"message":"nope"}]}');
    const client = clientOf(recorder(), exec);
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

describe('GhClient failure classification', () => {
  it.each([
    'error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com',
    'Post "https://api.github.com/graphql": dial tcp: lookup api.github.com: no such host',
    'Get "https://api.github.com/user": dial tcp 140.82.121.6:443: i/o timeout',
    'Post "https://api.github.com/graphql": net/http: TLS handshake timeout',
    'Post "https://api.github.com/graphql": context deadline exceeded',
    'Get "https://api.github.com/user": read tcp: connection reset by peer',
    'dial tcp 140.82.121.6:443: connect: connection refused',
    'dial tcp 140.82.121.6:443: connect: network is unreachable',
    'dial tcp: lookup api.github.com on 127.0.0.53:53: Temporary failure in name resolution',
  ])('treats %j as a connection failure', async (stderr) => {
    await expect(failureOf(stderr)).resolves.toBeInstanceOf(ConnectionError);
  });

  it.each([
    'To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.',
    'You are not logged into any GitHub hosts. To log in, run: gh auth login',
    'gh: Bad credentials (HTTP 401)',
    'HTTP 401: Bad credentials (https://api.github.com/user)',
    'gh: Requires authentication (HTTP 401)',
  ])('treats %j as missing authentication', async (stderr) => {
    await expect(failureOf(stderr)).resolves.toBeInstanceOf(AuthError);
  });

  it.each([
    'gh: API rate limit exceeded for user ID 1. If you reach out to GitHub Support for help, please include the request ID. (HTTP 403)',
    'gh: You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (HTTP 403)',
    'HTTP 429: too many requests (https://api.github.com/graphql)',
    'gh: API rate limit already exceeded for this user (RATE_LIMITED)',
  ])('treats %j as rate limiting', async (stderr) => {
    await expect(failureOf(stderr)).resolves.toBeInstanceOf(RateLimitError);
  });

  it.each([
    'gh: Not Found (HTTP 404)',
    'HTTP 404: Not Found (https://api.github.com/repos/acme/gone)',
    "gh: Could not resolve to a node with the global id of 'PRRC_1' (NOT_FOUND)",
  ])('treats %j as not found', async (stderr) => {
    await expect(failureOf(stderr)).resolves.toBeInstanceOf(RemoteNotFoundError);
  });

  it.each([
    'gh: Resource not accessible by integration (HTTP 403)',
    'gh: Validation Failed (HTTP 422)',
    'Could not resolve host: github.com',
    '',
  ])('leaves %j as a plain exec failure', async (stderr) => {
    await expect(failureOf(stderr)).resolves.toBeInstanceOf(ExecExitError);
  });
});
