import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { LanguageExtension, LanguageSession } from '@gepard/common';
import { __setUserDataDir } from './support/electron';
import { fakeLanguageSession } from './support/session';
import { makeTmpDir, type TmpDir } from './support/tmp';

const mocks = vi.hoisted(() => {
  const extensions: LanguageExtension[] = [];
  const lineIndexReady: Promise<void> = Promise.resolve();
  return { extensions, lineIndexReady };
});

vi.mock('../log', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('../notify', () => ({
  isNotifiableLevel: () => false,
  notifyMainFailure: vi.fn(),
}));
vi.mock('../services/line-index-manager', () => ({
  startLineIndex: () => mocks.lineIndexReady.then(() => null),
}));
vi.mock('../extensions/registry', () => ({
  extensionRegistry: { enabledLanguageExtensions: () => Promise.resolve(mocks.extensions) },
}));

const { indexer } = await import('../lsp/indexer');

interface FakeSession {
  session: LanguageSession;
  lineSymbols: Mock<LanguageSession['lineSymbols']>;
  filesChanged: Mock<LanguageSession['filesChanged']>;
}

function fakeSession(): FakeSession {
  const lineSymbols = vi.fn<LanguageSession['lineSymbols']>(() => Promise.resolve([]));
  const filesChanged = vi.fn<LanguageSession['filesChanged']>();
  return {
    session: fakeLanguageSession({ lineSymbols, filesChanged }),
    lineSymbols,
    filesChanged,
  };
}

interface FakeExtension extends Omit<LanguageExtension, 'open'> {
  open: LanguageExtension['open'];
}

function fakeExtension(id: string, suffix: string): FakeExtension {
  return {
    id,
    displayName: id.toUpperCase(),
    languages: [{ name: id, extensions: [suffix.replace(/^\./, '')] }],
    open: vi.fn(() => {
      if (id.startsWith('broken')) return Promise.reject(new Error(`${id} exploded`));
      const fake = fakeSession();
      sessions.set(id, fake);
      return Promise.resolve(fake.session);
    }),
  };
}

const sessions = new Map<string, FakeSession>();

describe('indexer with several language extensions', () => {
  let userData: TmpDir;

  beforeEach(async () => {
    userData = await makeTmpDir('lsp-multi');
    __setUserDataDir(userData.path);
    sessions.clear();
  });

  afterEach(async () => {
    await indexer.close('p');
    await userData.cleanup();
  });

  it('starts one session per matching extension and routes by file path', async () => {
    mocks.extensions = [fakeExtension('alpha', '.a'), fakeExtension('beta', '.b')];

    await indexer.open('p', '/repo', ['x.a', 'y.b', 'z.txt'], 'head');

    expect(indexer.status('p')).toEqual({ state: 'idle' });
    expect(indexer.session('p', 'dir/x.a')).toBe(sessions.get('alpha')?.session);
    expect(indexer.session('p', 'dir/y.b')).toBe(sessions.get('beta')?.session);
    expect(indexer.session('p', 'z.txt')).toBeNull();
    expect(indexer.sessions('p')).toHaveLength(2);
  });

  it('does not start an extension that matches none of the files', async () => {
    const alpha = fakeExtension('alpha', '.a');
    const beta = fakeExtension('beta', '.b');
    mocks.extensions = [alpha, beta];

    await indexer.open('p', '/repo', ['x.a'], 'head');

    expect(alpha.open).toHaveBeenCalledTimes(1);
    expect(beta.open).not.toHaveBeenCalled();
    expect(indexer.session('p', 'y.b')).toBeNull();
  });

  it('keeps the working sessions and stays idle when only one extension fails to start', async () => {
    mocks.extensions = [fakeExtension('broken', '.a'), fakeExtension('beta', '.b')];

    await indexer.open('p', '/repo', ['x.a', 'y.b'], 'head');

    expect(indexer.status('p')).toEqual({ state: 'idle' });
    expect(indexer.session('p', 'x.a')).toBeNull();
    expect(indexer.session('p', 'y.b')).toBe(sessions.get('beta')?.session);
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

  it('reports every enabled extension, with present ones active or failed and the rest absent', async () => {
    mocks.extensions = [
      fakeExtension('broken', '.a'),
      fakeExtension('beta', '.b'),
      fakeExtension('gamma', '.c'),
    ];

    await indexer.open('p', '/repo', ['x.a', 'y.b'], 'head');

    expect(indexer.languages('p')).toEqual([
      { id: 'broken', displayName: 'BROKEN', state: 'failed', message: 'broken exploded' },
      { id: 'beta', displayName: 'BETA', state: 'active' },
      { id: 'gamma', displayName: 'GAMMA', state: 'absent' },
    ]);
  });

  it('reports every enabled extension as absent when none matches the project files', async () => {
    mocks.extensions = [fakeExtension('alpha', '.a'), fakeExtension('beta', '.b')];

    await indexer.open('p', '/repo', ['z.txt'], 'head');

    expect(indexer.languages('p')).toEqual([
      { id: 'alpha', displayName: 'ALPHA', state: 'absent' },
      { id: 'beta', displayName: 'BETA', state: 'absent' },
    ]);
  });

  it('reports a language session as starting until it settles', async () => {
    let release: (session: LanguageSession) => void = () => {};
    const slow = fakeExtension('slow', '.a');
    slow.open = vi.fn(
      () =>
        new Promise<LanguageSession>((resolve) => {
          release = resolve;
        }),
    );
    mocks.extensions = [slow];

    const opening = indexer.open('p', '/repo', ['x.a'], 'head');
    await vi.waitFor(() => expect(slow.open).toHaveBeenCalled());

    expect(indexer.languages('p')).toEqual([
      { id: 'slow', displayName: 'SLOW', state: 'starting' },
    ]);

    release(fakeSession().session);
    await opening;

    expect(indexer.languages('p')).toEqual([{ id: 'slow', displayName: 'SLOW', state: 'active' }]);
  });

  it('reports no language server list for an unknown project', () => {
    expect(indexer.languages('unknown')).toBeNull();
  });

  it('lists the language servers while files are still being indexed', async () => {
    let finishFiles: () => void = () => {};
    mocks.lineIndexReady = new Promise<void>((resolve) => {
      finishFiles = resolve;
    });
    mocks.extensions = [fakeExtension('alpha', '.a'), fakeExtension('beta', '.b')];

    const opening = indexer.open('p', '/repo', ['x.a'], 'head');
    await vi.waitFor(() => expect(indexer.languages('p')).not.toBeNull());

    expect(indexer.status('p')).toMatchObject({ state: 'indexing', phase: 'files' });
    expect(indexer.languages('p')).toEqual([
      { id: 'alpha', displayName: 'ALPHA', state: 'starting' },
      { id: 'beta', displayName: 'BETA', state: 'absent' },
    ]);

    finishFiles();
    mocks.lineIndexReady = Promise.resolve();
    await opening;
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
