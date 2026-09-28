import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LanguageExtension, LanguageSession } from '../lsp/session';
import { __setUserDataDir } from './support/electron';
import { makeTmpDir, type TmpDir } from './support/tmp';

const mocks = vi.hoisted(() => ({
  extensions: [] as unknown[],
  start: vi.fn(),
}));

vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../notify', () => ({
  isNotifiableLevel: () => false,
  notifyMainFailure: vi.fn(),
}));
vi.mock('../services/line-index-manager', () => ({
  startLineIndex: async () => null,
}));
vi.mock('../extensions/registry', () => ({
  extensionRegistry: { enabledLanguageExtensions: async () => mocks.extensions },
}));
vi.mock('../lsp/session', () => ({ LspSession: { start: mocks.start } }));

const { indexer } = await import('../lsp/indexer');

function fakeExtension(id: string, suffix: string): LanguageExtension {
  return {
    id,
    displayName: id.toUpperCase(),
    matches: (f) => f.endsWith(suffix),
    languageId: () => id,
    resolve: async (project) => ({ command: id, args: [], cwd: project.root }),
  };
}

function fakeSession(name: string): LanguageSession {
  return {
    name,
    lineSymbols: vi.fn(async () => []),
    filesChanged: vi.fn(),
    dispose: vi.fn(async () => undefined),
  } as unknown as LanguageSession;
}

describe('indexer with several language extensions', () => {
  let userData: TmpDir;
  const sessions = new Map<string, LanguageSession>();

  beforeEach(async () => {
    userData = await makeTmpDir('lsp-multi');
    __setUserDataDir(userData.path);
    sessions.clear();
    mocks.start.mockImplementation(async (plan: { command: string }) => {
      if (plan.command.startsWith('broken')) throw new Error(`${plan.command} exploded`);
      const session = fakeSession(plan.command);
      sessions.set(plan.command, session);
      return session;
    });
  });

  afterEach(async () => {
    await indexer.close('p');
    await userData.cleanup();
    mocks.start.mockReset();
  });

  it('starts one session per matching extension and routes by file path', async () => {
    mocks.extensions = [fakeExtension('alpha', '.a'), fakeExtension('beta', '.b')];

    await indexer.open('p', '/repo', ['x.a', 'y.b', 'z.txt'], 'head');

    expect(indexer.status('p')).toEqual({ state: 'idle' });
    expect(indexer.session('p', 'dir/x.a')).toBe(sessions.get('alpha'));
    expect(indexer.session('p', 'dir/y.b')).toBe(sessions.get('beta'));
    expect(indexer.session('p', 'z.txt')).toBeNull();
    expect(indexer.sessions('p')).toHaveLength(2);
  });

  it('does not start an extension that matches none of the files', async () => {
    mocks.extensions = [fakeExtension('alpha', '.a'), fakeExtension('beta', '.b')];

    await indexer.open('p', '/repo', ['x.a'], 'head');

    expect(mocks.start).toHaveBeenCalledTimes(1);
    expect(indexer.session('p', 'y.b')).toBeNull();
  });

  it('keeps the working sessions and stays idle when only one extension fails to start', async () => {
    mocks.extensions = [fakeExtension('broken', '.a'), fakeExtension('beta', '.b')];

    await indexer.open('p', '/repo', ['x.a', 'y.b'], 'head');

    expect(indexer.status('p')).toEqual({ state: 'idle' });
    expect(indexer.session('p', 'x.a')).toBeNull();
    expect(indexer.session('p', 'y.b')).toBe(sessions.get('beta'));
  });

  it('reports an error naming every extension when all of them fail to start', async () => {
    mocks.extensions = [fakeExtension('broken1', '.a'), fakeExtension('broken2', '.b')];

    await indexer.open('p', '/repo', ['x.a', 'y.b'], 'head');

    const status = indexer.status('p');
    expect(status.state).toBe('error');
    expect(status.state === 'error' && status.message).toContain('BROKEN1: broken1 exploded');
    expect(status.state === 'error' && status.message).toContain('BROKEN2: broken2 exploded');
    expect(indexer.sessions('p')).toEqual([]);
  });

  it('forwards checkout changes to every session', async () => {
    mocks.extensions = [fakeExtension('alpha', '.a'), fakeExtension('beta', '.b')];
    await indexer.open('p', '/repo', ['x.a', 'y.b'], 'head');

    const changes = [{ path: 'x.a', type: 'changed' as const }];
    indexer.onCheckout('p', changes, 'sha2', 2);

    for (const session of sessions.values()) {
      expect(session.filesChanged).toHaveBeenCalledWith(changes);
    }
  });

  it('warms each session up with its own extension file', async () => {
    mocks.extensions = [
      {
        ...fakeExtension('alpha', '.a'),
        warmupFile: (files: string[]) => files.find((f) => f === 'main.a'),
      },
      fakeExtension('beta', '.b'),
    ];

    await indexer.open('p', '/repo', ['other.a', 'main.a', 'y.b'], 'head');

    expect(sessions.get('alpha')?.lineSymbols).toHaveBeenCalledWith('main.a', 1);
    expect(sessions.get('beta')?.lineSymbols).toHaveBeenCalledWith('y.b', 1);
  });
});
