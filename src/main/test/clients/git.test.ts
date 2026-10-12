import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ExecExitError } from '@gepard/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GitClient, gitSubcommand, isRemoteGitCommand } from '../../clients/git';
import type { RemoteObserver } from '../../clients/remote';
import { ConnectionError } from '../../helpers/process/connection';
import { run, runBuffer } from '../../helpers/process/exec';
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

  it('passes a non-connection remote failure through unchanged', async () => {
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
    const client = new GitClient(observer, {
      run: () =>
        Promise.reject(
          new ExecExitError(
            'git',
            ['fetch'],
            128,
            null,
            "fatal: unable to access 'https://github.com/a/b/': Could not resolve host: github.com",
          ),
        ),
      runBuffer,
    });
    const failure = client.run(repo.path, ['fetch', 'origin', '--prune']);
    await expect(failure).rejects.toBeInstanceOf(ConnectionError);
    expect(observer.results).toHaveLength(1);
    expect(observer.results[0].ok).toBe(false);
    expect(observer.results[0].error).toBeInstanceOf(ConnectionError);
  });

  it('never translates a local failure, even with connection-like stderr', async () => {
    const observer = recorder();
    const client = new GitClient(observer, {
      run: () =>
        Promise.reject(new ExecExitError('git', ['status'], 1, null, 'Connection refused')),
      runBuffer,
    });
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
