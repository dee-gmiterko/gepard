import { createElement, type Dispatch, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ChannelOutput } from '@gepard/common';
import { afterEach, describe, expect, it } from 'vitest';
import { AppDispatchContext, AppStateContext } from '../src/state/AppContext';
import { appReducer, initialAppState, type AppAction, type AppState } from '../src/state/reducer';
import { useTargetActions, type TargetActions } from '../src/features/header/useTargetActions';
import { useSync } from '../src/queries/comments';
import { createFakeIpc, type FakeIpc, type Handlers } from './support/fakeIpc';

function installIpc(handlers: Handlers): FakeIpc {
  const ipc = createFakeIpc(handlers);
  Object.defineProperty(globalThis, 'window', {
    value: { ipc: ipc.bridge },
    configurable: true,
    writable: true,
  });
  return ipc;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

function renderWith<T>(state: AppState, dispatch: Dispatch<AppAction>, use: () => T): T {
  let captured: T | undefined;
  function Probe(): ReactNode {
    captured = use();
    return null;
  }
  renderToString(
    createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(
        AppStateContext.Provider,
        { value: state },
        createElement(AppDispatchContext.Provider, { value: dispatch }, createElement(Probe)),
      ),
    ),
  );
  if (captured === undefined) throw new Error('hook did not render');
  return captured;
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function startFrom(targeting: AppState['targeting']): {
  actions: TargetActions;
  persisted: () => unknown[];
  current: () => AppState;
} {
  const ipc = installIpc({ 'projects.setTargeting': () => undefined });
  let live: AppState = { ...initialAppState, projectId: 'p1', targeting };
  const actions = renderWith(
    live,
    (a) => (live = appReducer(live, a)),
    () => useTargetActions(),
  );
  return {
    actions,
    persisted: () => ipc.callsTo('projects.setTargeting').map((c) => c.targeting),
    current: () => live,
  };
}

describe('target actions persist what the reducer applies', () => {
  const full = { pr: 7, commit: 'c'.repeat(40), path: 'src/a.ts' };

  it('selecting a different PR clears the commit in state and in persistence', async () => {
    const { actions, persisted, current } = startFrom(full);
    actions.setPr(8);
    await flush();
    expect(current().targeting).toEqual({ pr: 8, commit: null, path: 'src/a.ts' });
    expect(persisted().at(-1)).toEqual(current().targeting);
  });

  it('selecting a commit persists it next to the PR and path', async () => {
    const { actions, persisted, current } = startFrom({ pr: 7, commit: null, path: 'src/a.ts' });
    actions.setCommit('d'.repeat(40));
    await flush();
    expect(current().targeting.commit).toBe('d'.repeat(40));
    expect(persisted().at(-1)).toEqual(current().targeting);
  });

  it('selecting a path persists it next to the PR and commit', async () => {
    const { actions, persisted, current } = startFrom(full);
    actions.setPath('src/b.ts');
    await flush();
    expect(persisted().at(-1)).toEqual(current().targeting);
  });

  it('re-selecting the same PR keeps the commit in state and persists the same targeting', async () => {
    const { actions, persisted, current } = startFrom(full);
    actions.setPr(7);
    await flush();
    expect(current().targeting).toEqual(full);
    expect(persisted().at(-1)).toEqual(current().targeting);
  });
});

describe('sync results', () => {
  function startSync(pr: number): {
    sync: ReturnType<typeof useSync>;
    current: () => AppState;
    set: (action: AppAction) => void;
    resolve: (value: { base: string; head: string }) => void;
  } {
    let resolveSync: (v: ChannelOutput<'sync.run'>) => void = () => {};
    installIpc({
      'sync.run': () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        }),
    });
    let live: AppState = {
      ...initialAppState,
      projectId: 'p1',
      targeting: { pr, commit: null, path: null },
    };
    const sync = renderWith(
      live,
      (a) => (live = appReducer(live, a)),
      () => useSync(),
    );
    return {
      sync,
      current: () => live,
      set: (action) => (live = appReducer(live, action)),
      resolve: (value) =>
        resolveSync({ ...value, syncedAt: '2026-01-01T00:00:00Z', droppedRemoteDeleted: 0 }),
    };
  }

  it('stores the checkout of a sync that finishes for the still-targeted PR', async () => {
    const run = startSync(1);
    run.sync.mutate('pull');
    await flush();
    run.resolve({ base: BASE, head: HEAD });
    await flush();
    expect(run.current().checkout).toEqual({ base: BASE, head: HEAD });
  });

  it('ignores the result of a sync that finishes after the target switched to another PR', async () => {
    const run = startSync(1);
    run.sync.mutate('pull');
    await flush();
    run.set({ type: 'target/pr', pr: 2 });
    run.resolve({ base: BASE, head: HEAD });
    await flush();
    expect(run.current().targeting.pr).toBe(2);
    expect(run.current().checkout).toBeNull();
  });
});
