import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AuthError, ConnectionError, ExecExitError } from '@gepard/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitClient, gitSubcommand, isRemoteGitCommand, type GitExec } from '../../clients/git';
import { run, runBuffer } from '../../helpers/process/exec';
import type { RemoteObserver } from '../../services/connectivity';
import { makeTmpDir, type TmpDir } from '../support/tmp';

const execFileP = promisify(execFile);

interface Recorded {
  ok: boolean;
  error?: unknown;
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

function failingExec(args: string[], exitCode: number, stderr: string): GitExec {
  return {
    run: () => Promise.reject(new ExecExitError('git', args, exitCode, null, stderr)),
    runBuffer,
  };
}

async function remoteFailureOf(stderr: string): Promise<unknown> {
  return new GitClient(recorder(), failingExec(['fetch'], 128, stderr))
    .run('/repo', ['fetch', 'origin', '--prune'])
    .then(
      () => undefined,
      (e: unknown) => e,
    );
}

describe('gitSubcommand', () => {
  it.each([
    [['status'], 'status'],
    [['-c', 'credential.helper=', 'fetch', 'origin'], 'fetch'],
    [['-c', 'a=b', '-c', 'c=d', '-C', '/repo', 'clone', 'url', 'dir'], 'clone'],
    [['--no-pager', '--git-dir=.git', 'log'], 'log'],
    [['-c', 'core.hooksPath=/x', 'diff-tree', '--stdin', '-r'], 'diff-tree'],
    [[], null],
    [['-c', 'only=option'], null],
  ])('finds the subcommand in %j', (args, expected) => {
    expect(gitSubcommand(args)).toBe(expected);
  });
});

describe('isRemoteGitCommand', () => {
  it.each([
    ['fetch', 'origin', '--prune'],
    ['-c', 'credential.helper=', 'clone', 'url', 'dir'],
    ['push', 'origin', 'main'],
    ['pull'],
    ['ls-remote', 'origin'],
  ])('treats %s as remote', (...args) => {
    expect(isRemoteGitCommand(args)).toBe(true);
  });

  it.each([
    ['rev-parse', 'HEAD'],
    ['-c', 'credential.helper=', 'diff', '--name-status', 'fetch'],
    ['cat-file', 'blob', 'abc'],
    ['-c', 'remote.origin.url=x', 'status'],
    ['checkout', '--detach', 'clone'],
  ])('treats %s as local', (...args) => {
    expect(isRemoteGitCommand(args)).toBe(false);
  });
});

describe('GitClient', () => {
  let repo: TmpDir;

  beforeAll(async () => {
    repo = await makeTmpDir('git-client');
    await execFileP('git', ['init', '-q', '-b', 'main'], { cwd: repo.path });
  });

  afterAll(async () => {
    await repo.cleanup();
  });

  it('runs a local command without telling the observer', async () => {
    const observer = recorder();
    const client = new GitClient(observer);
    const { stdout } = await client.run(repo.path, ['rev-parse', '--is-inside-work-tree']);
    expect(stdout.trim()).toBe('true');
    expect(observer.results).toEqual([]);
  });

  it('reads a blob as a buffer without telling the observer', async () => {
    const observer = recorder();
    const client = new GitClient(observer);
    const { stdout } = await run('git', ['hash-object', '-w', '--stdin'], {
      cwd: repo.path,
      stdin: 'hello\n',
    });
    const blob = await client.buffer(repo.path, ['cat-file', '-t', stdout.trim()]);
    expect(blob.stdout.toString('utf8').trim()).toBe('blob');
    expect(observer.results).toEqual([]);
  });

  it('reports a successful remote command to the observer', async () => {
    const observer = recorder();
    const client = new GitClient(observer);
    await client.run(repo.path, ['ls-remote', repo.path]);
    expect(observer.results).toEqual([{ ok: true }]);
  });

  it('passes an unrecognised remote failure through unchanged', async () => {
    const observer = recorder();
    const client = new GitClient(observer);
    const failure = client.run(repo.path, ['fetch', 'no-such-remote']);
    await expect(failure).rejects.toBeInstanceOf(ExecExitError);
    await expect(failure).rejects.not.toBeInstanceOf(ConnectionError);
    expect(observer.results).toHaveLength(1);
    expect(observer.results[0].ok).toBe(false);
    expect(observer.results[0].error).toBeInstanceOf(ExecExitError);
  });

  it('translates a connection failure of a remote command and notifies the observer', async () => {
    const observer = recorder();
    const stderr =
      "fatal: unable to access 'https://github.com/a/b/': Could not resolve host: github.com";
    const client = new GitClient(observer, failingExec(['fetch'], 128, stderr));
    const failure = client.run(repo.path, ['fetch', 'origin', '--prune']);
    await expect(failure).rejects.toBeInstanceOf(ConnectionError);
    await expect(failure).rejects.toMatchObject({
      code: 'CONNECTION_FAILED',
      details: { cmd: 'git', exitCode: 128, stderr },
    });
    expect(observer.results).toHaveLength(1);
    expect(observer.results[0].ok).toBe(false);
    expect(observer.results[0].error).toBeInstanceOf(ConnectionError);
  });

  it('never translates a local failure, even with connection-like stderr', async () => {
    const observer = recorder();
    const client = new GitClient(observer, failingExec(['status'], 1, 'Connection refused'));
    const failure = client.run(repo.path, ['status']);
    await expect(failure).rejects.toBeInstanceOf(ExecExitError);
    await expect(failure).rejects.not.toBeInstanceOf(ConnectionError);
    expect(observer.results).toEqual([]);
  });

  it('clones with hooks disabled and reports to the observer', async () => {
    const observer = recorder();
    const client = new GitClient(observer);
    const hooks = await makeTmpDir('git-client-hooks');
    const target = await makeTmpDir('git-client-clone');
    try {
      await client.clone(repo.path, `${target.path}/clone`, { hooksPath: hooks.path });
      const { stdout } = await run('git', ['config', 'core.hooksPath'], {
        cwd: `${target.path}/clone`,
      });
      expect(stdout.trim()).toBe(hooks.path);
      expect(observer.results).toEqual([{ ok: true }]);
    } finally {
      await hooks.cleanup();
      await target.cleanup();
    }
  });
});

describe('GitClient remote failure classification', () => {
  it.each([
    "fatal: unable to access 'https://github.com/acme/widgets/': Could not resolve host: github.com",
    "fatal: unable to access 'https://github.com/acme/widgets/': Could not resolve proxy: proxy.local",
    "fatal: unable to access 'https://github.com/acme/widgets/': Failed to connect to github.com port 443 after 21 ms: Connection refused",
    "fatal: unable to access 'https://github.com/acme/widgets/': Failed to connect to github.com port 443: Timeout was reached",
    "fatal: unable to access 'https://github.com/acme/widgets/': Recv failure: Connection reset by peer",
    "fatal: unable to access 'https://github.com/acme/widgets/': OpenSSL SSL_connect: SSL_ERROR_SYSCALL in connection to github.com:443",
    "fatal: unable to access 'https://github.com/acme/widgets/': Empty reply from server",
    'ssh: connect to host github.com port 22: Network is unreachable\nfatal: Could not read from remote repository.',
    'ssh: Could not resolve hostname github.com: Temporary failure in name resolution',
    'ssh: connect to host github.com port 22: No route to host',
    'error: RPC failed; curl 28 Operation timed out after 300000 milliseconds',
  ])('treats %j as a connection failure', async (stderr) => {
    await expect(remoteFailureOf(stderr)).resolves.toBeInstanceOf(ConnectionError);
  });

  it.each([
    "fatal: Authentication failed for 'https://github.com/acme/widgets/'",
    "fatal: could not read Username for 'https://github.com': terminal prompts disabled",
    'git@github.com: Permission denied (publickey).\nfatal: Could not read from remote repository.',
    'remote: Invalid username or password.\nfatal: Authentication failed',
    "fatal: unable to access 'https://github.com/acme/widgets/': The requested URL returned error: 403",
  ])('treats %j as an authentication failure', async (stderr) => {
    await expect(remoteFailureOf(stderr)).resolves.toBeInstanceOf(AuthError);
  });

  it.each([
    "remote: Repository not found.\nfatal: repository 'https://github.com/acme/gone/' not found",
    "fatal: couldn't find remote ref refs/pull/99/head",
    "fatal: 'no-such-remote' does not appear to be a git repository",
    'error connecting to api.github.com',
    '',
  ])('leaves %j as a plain exec failure', async (stderr) => {
    await expect(remoteFailureOf(stderr)).resolves.toBeInstanceOf(ExecExitError);
  });
});
