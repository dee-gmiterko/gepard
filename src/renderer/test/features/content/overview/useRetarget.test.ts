import { describe, expect, it } from 'vitest';
import { initialUiState, type Targeting, type UiState } from '../../../../src/state/reducer';
import { createUiStore } from '../../../../src/state/uiStore';
import { useRetarget } from '../../../../src/features/content/overview/shared/useRetarget';
import { flush, installIpc, renderWith } from '../../../support/hookHarness';

function startFrom(targeting: UiState['targeting']): {
  retarget: (next: Targeting) => void;
  persisted: () => unknown[];
  current: () => UiState;
} {
  const ipc = installIpc({ 'projects.setTargeting': () => undefined });
  const handle = createUiStore({ ...initialUiState, projectId: 'p1', targeting });
  const retarget = renderWith(handle, () => useRetarget());
  return {
    retarget,
    persisted: () => ipc.callsTo('projects.setTargeting').map((c) => c.targeting),
    current: () => handle.store.getState(),
  };
}

describe('overview retargeting', () => {
  const full = { pr: 7, commit: 'c'.repeat(40), path: 'src/a.ts' };

  it('keeps the commit when the PR is unchanged and persists the full targeting once', async () => {
    const { retarget, persisted, current } = startFrom(full);
    retarget({ ...full, path: 'src/b.ts' });
    await flush();
    expect(current().targeting).toEqual({ ...full, path: 'src/b.ts' });
    expect(persisted()).toEqual([current().targeting]);
  });

  it('applies another PR with its commit and path together', async () => {
    const { retarget, persisted, current } = startFrom(full);
    retarget({ pr: 8, commit: 'e'.repeat(40), path: null });
    await flush();
    expect(current().targeting).toEqual({ pr: 8, commit: 'e'.repeat(40), path: null });
    expect(persisted()).toEqual([current().targeting]);
  });

  it('clears the old commit when switching to another PR without one', async () => {
    const { retarget, current } = startFrom(full);
    retarget({ pr: 8, commit: null, path: 'src/a.ts' });
    await flush();
    expect(current().targeting).toEqual({ pr: 8, commit: null, path: 'src/a.ts' });
  });
});
