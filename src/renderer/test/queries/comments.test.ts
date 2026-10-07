import type { ChannelOutput } from '@gepard/common';
import { describe, expect, it } from 'vitest';
import { initialUiState, type UiAction, type UiState } from '../../src/state/reducer';
import { createUiStore } from '../../src/state/uiStore';
import { useSync } from '../../src/queries/comments';
import { flush, installIpc, renderWith } from '../support/hookHarness';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);

describe('sync results', () => {
  function startSync(pr: number): {
    sync: ReturnType<typeof useSync>;
    current: () => UiState;
    set: (action: UiAction) => void;
    resolve: (value: { base: string; head: string }) => void;
  } {
    let resolveSync: (v: ChannelOutput<'sync.run'>) => void = () => {};
    installIpc({
      'sync.run': () =>
        new Promise((resolve) => {
          resolveSync = resolve;
        }),
    });
    const handle = createUiStore({
      ...initialUiState,
      projectId: 'p1',
      targeting: { pr, commit: null, path: null },
    });
    const sync = renderWith(handle, () => useSync());
    return {
      sync,
      current: () => handle.store.getState(),
      set: (action) => handle.dispatch(action),
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
    expect(run.current().checkoutHead).toEqual({ base: BASE, head: HEAD });
  });

  it('ignores the result of a sync that finishes after the target switched to another PR', async () => {
    const run = startSync(1);
    run.sync.mutate('pull');
    await flush();
    run.set({ type: 'target/pr', pr: 2 });
    run.resolve({ base: BASE, head: HEAD });
    await flush();
    expect(run.current().targeting.pr).toBe(2);
    expect(run.current().checkoutHead).toBeNull();
  });
});
