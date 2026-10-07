import { describe, expect, it } from 'vitest';
import { initialAppState, type AppState } from '../../../src/state/reducer';
import { createUiStore } from '../../../src/state/uiStore';
import {
  useTargetActions,
  type TargetActions,
} from '../../../src/features/header/useTargetActions';
import { flush, installIpc, renderWith } from '../../support/hookHarness';

function startFrom(targeting: AppState['targeting']): {
  actions: TargetActions;
  persisted: () => unknown[];
  current: () => AppState;
} {
  const ipc = installIpc({ 'projects.setTargeting': () => undefined });
  const handle = createUiStore({ ...initialAppState, projectId: 'p1', targeting });
  const actions = renderWith(handle, () => useTargetActions());
  return {
    actions,
    persisted: () => ipc.callsTo('projects.setTargeting').map((c) => c.targeting),
    current: () => handle.store.getState(),
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
