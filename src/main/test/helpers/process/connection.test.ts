import { AppError, ExecExitError, ExecSpawnError } from '@gepard/common';
import { describe, expect, it } from 'vitest';
import {
  CONNECTION_FAILED,
  ConnectionError,
  isConnectionFailureText,
  toConnectionError,
} from '../../../helpers/process/connection';

function ghFailure(stderr: string): ExecExitError {
  return new ExecExitError('gh', ['api', 'user'], 1, null, stderr);
}

describe('isConnectionFailureText', () => {
  it.each([
    "fatal: unable to access 'https://github.com/acme/widgets/': Could not resolve host: github.com",
    "fatal: unable to access 'https://github.com/acme/widgets/': Failed to connect to github.com port 443 after 21 ms: Connection refused",
    "fatal: unable to access 'https://github.com/acme/widgets/': Failed to connect to github.com port 443: Timeout was reached",
    'ssh: connect to host github.com port 22: Network is unreachable',
    'error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com',
    'Post "https://api.github.com/graphql": dial tcp: lookup api.github.com: no such host',
    'Get "https://api.github.com/user": dial tcp 140.82.121.6:443: i/o timeout',
    'Post "https://api.github.com/graphql": net/http: TLS handshake timeout',
    'Post "https://api.github.com/graphql": context deadline exceeded',
    'Get "https://api.github.com/user": read tcp: connection reset by peer',
    'dial tcp: lookup api.github.com on 127.0.0.53:53: Temporary failure in name resolution',
    'getaddrinfo ENOTFOUND api.github.com',
    'connect ECONNREFUSED 127.0.0.1:443',
  ])('matches %s', (stderr) => {
    expect(isConnectionFailureText(stderr)).toBe(true);
  });

  it.each([
    "fatal: unable to access 'https://github.com/acme/widgets/': The requested URL returned error: 403",
    'gh: Not Found (HTTP 404)',
    'You are not logged into any GitHub hosts. To log in, run: gh auth login',
    'fatal: not a git repository (or any of the parent directories): .git',
    "error: pathspec 'nope' did not match any file(s) known to git",
    '',
  ])('leaves %s alone', (stderr) => {
    expect(isConnectionFailureText(stderr)).toBe(false);
  });
});

describe('toConnectionError', () => {
  it('wraps an exec failure whose stderr reports a connection problem', () => {
    const cause = ghFailure('error connecting to api.github.com\ncheck your internet connection');
    const wrapped = toConnectionError(cause);
    expect(wrapped).toBeInstanceOf(ConnectionError);
    expect(wrapped).toMatchObject({
      code: CONNECTION_FAILED,
      cmd: 'gh',
      args: ['api', 'user'],
      exitCode: 1,
      stderr: cause.stderr,
      message: cause.message,
    });
  });

  it('returns the same instance for an already wrapped error', () => {
    const wrapped = new ConnectionError(ghFailure('Could not resolve host: github.com'));
    expect(toConnectionError(wrapped)).toBe(wrapped);
  });

  it('ignores exec failures with unrelated stderr', () => {
    expect(toConnectionError(ghFailure('gh: Not Found (HTTP 404)'))).toBeNull();
  });

  it('ignores a missing binary', () => {
    const spawn = new ExecSpawnError({ code: 'ENOENT', message: 'spawn gh ENOENT' }, 'gh', [], '');
    expect(toConnectionError(spawn)).toBeNull();
  });

  it('ignores errors that are not exec failures', () => {
    expect(toConnectionError(new AppError('NOT_FOUND', 'Could not resolve host'))).toBeNull();
    expect(toConnectionError(new Error('ECONNREFUSED'))).toBeNull();
    expect(toConnectionError('ECONNREFUSED')).toBeNull();
  });
});
