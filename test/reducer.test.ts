import { describe, expect, it } from 'vitest';
import { appReducer, initialAppState, type AppState } from '../src/renderer/src/state/reducer';

function state(overrides: Partial<AppState> = {}): AppState {
  return { ...initialAppState, ...overrides };
}

describe('targeting behaviors', () => {
  it('changing the PR clears the commit and switches the side panel to targeted', () => {
    const withCommit = state({ targeting: { pr: null, commit: 'deadbeef', path: null } });
    const next = appReducer(withCommit, { type: 'target/pr', pr: 7 });
    expect(next.targeting).toEqual({ pr: 7, commit: null, path: null });
    expect(next.sidePanelTab).toBe('targeted');
  });

  it('clearing the PR (pr: null) does not force the side panel to targeted', () => {
    const withPr = state({
      targeting: { pr: 7, commit: null, path: null },
      sidePanelTab: 'search',
    });
    const next = appReducer(withPr, { type: 'target/pr', pr: null });
    expect(next.targeting.pr).toBeNull();
    expect(next.sidePanelTab).toBe('search');
  });

  it('setting a commit or a path target also switches to the targeted panel', () => {
    const s = state({ sidePanelTab: 'files' });
    expect(appReducer(s, { type: 'target/commit', sha: 'abc123' }).sidePanelTab).toBe('targeted');
    expect(appReducer(s, { type: 'target/path', path: 'src' }).sidePanelTab).toBe('targeted');
  });

  it('is a no-op (same reference) when the target does not actually change', () => {
    const s = state({ targeting: { pr: 7, commit: null, path: null } });
    expect(appReducer(s, { type: 'target/pr', pr: 7 })).toBe(s);
  });
});

describe('opening a project', () => {
  it('resets everything, including pinned files', () => {
    const s = state({ pinnedFiles: ['a.ts'], projectId: 'proj-a' });
    const next = appReducer(s, {
      type: 'project/open',
      projectId: 'proj-b',
      targeting: { pr: null, commit: null, path: null },
      layout: initialAppState.layout,
    });
    expect(next).toEqual({ ...initialAppState, projectId: 'proj-b' });
  });

  it('applies its persisted targeting in the same dispatch and switches to the targeted panel', () => {
    const s = state({ pinnedFiles: ['a.ts'], projectId: 'proj-a' });
    const next = appReducer(s, {
      type: 'project/open',
      projectId: 'proj-b',
      targeting: { pr: 7, commit: 'deadbeef', path: 'src' },
      layout: initialAppState.layout,
    });
    expect(next.targeting).toEqual({ pr: 7, commit: 'deadbeef', path: 'src' });
    expect(next.sidePanelTab).toBe('targeted');
    expect(next.pinnedFiles).toEqual([]);
  });

  it('does not force the side panel to targeted when there is no persisted targeting', () => {
    const s = state({ projectId: 'proj-a' });
    const next = appReducer(s, {
      type: 'project/open',
      projectId: 'proj-b',
      targeting: { pr: null, commit: null, path: null },
      layout: initialAppState.layout,
    });
    expect(next.sidePanelTab).toBe('files');
  });
});

describe('pinned files', () => {
  it('are preserved across target changes', () => {
    const s = state({ pinnedFiles: ['a.ts', 'b.ts'] });
    const next = appReducer(s, { type: 'target/pr', pr: 3 });
    expect(next.pinnedFiles).toEqual(['a.ts', 'b.ts']);
  });
});

describe('preview file', () => {
  it('opening a non-pinned file sets it as both the preview and the active file', () => {
    const next = appReducer(state(), { type: 'file/open', path: 'a.ts' });
    expect(next.previewFile).toBe('a.ts');
    expect(next.activeFile).toBe('a.ts');
  });

  it('opening another non-pinned file replaces the previous preview file', () => {
    const withPreview = state({ previewFile: 'a.ts', activeFile: 'a.ts' });
    const next = appReducer(withPreview, { type: 'file/open', path: 'b.ts' });
    expect(next.previewFile).toBe('b.ts');
    expect(next.activeFile).toBe('b.ts');
  });

  it('opening a pinned file activates it without touching the preview slot', () => {
    const withPreview = state({
      pinnedFiles: ['pinned.ts'],
      previewFile: 'a.ts',
      activeFile: 'a.ts',
    });
    const next = appReducer(withPreview, { type: 'file/open', path: 'pinned.ts' });
    expect(next.activeFile).toBe('pinned.ts');
    expect(next.previewFile).toBe('a.ts');
  });

  it('pinning the currently previewed file clears the preview slot', () => {
    const s = state({ previewFile: 'a.ts', activeFile: 'a.ts' });
    const next = appReducer(s, { type: 'file/pin', path: 'a.ts' });
    expect(next.pinnedFiles).toEqual(['a.ts']);
    expect(next.previewFile).toBeNull();
  });

  it('unpinning the active file falls back to the preview file, then the last pinned file', () => {
    const withPreview = state({
      pinnedFiles: ['a.ts', 'b.ts'],
      activeFile: 'a.ts',
      previewFile: 'preview.ts',
    });
    expect(appReducer(withPreview, { type: 'file/unpin', path: 'a.ts' }).activeFile).toBe(
      'preview.ts',
    );

    const withoutPreview = state({
      pinnedFiles: ['a.ts', 'b.ts'],
      activeFile: 'a.ts',
      previewFile: null,
    });
    const next = appReducer(withoutPreview, { type: 'file/unpin', path: 'a.ts' });
    expect(next.pinnedFiles).toEqual(['b.ts']);
    expect(next.activeFile).toBe('b.ts');
  });
});

describe('toast slice', () => {
  const toast = (id: string): AppState['toasts'][number] => ({
    id,
    tone: 'danger',
    message: `failure ${id}`,
  });

  it('pushes in order and dismisses by id', () => {
    let s = appReducer(state(), { type: 'toast/push', toast: toast('1') });
    s = appReducer(s, { type: 'toast/push', toast: toast('2') });
    expect(s.toasts.map((t) => t.id)).toEqual(['1', '2']);
    s = appReducer(s, { type: 'toast/dismiss', id: '1' });
    expect(s.toasts.map((t) => t.id)).toEqual(['2']);
  });

  it('keeps toasts across project open/close (they are not project state)', () => {
    const withToast = state({ projectId: 'p', toasts: [toast('1')] });
    expect(
      appReducer(withToast, {
        type: 'project/open',
        projectId: 'q',
        targeting: { pr: null, commit: null, path: null },
        layout: initialAppState.layout,
      }).toasts,
    ).toEqual([toast('1')]);
    expect(appReducer(withToast, { type: 'project/close' }).toasts).toEqual([toast('1')]);
  });
});

describe('settings overlay', () => {
  it('opens and closes via settings/setOpen', () => {
    const opened = appReducer(state(), { type: 'settings/setOpen', open: true });
    expect(opened.settingsOpen).toBe(true);
    expect(appReducer(opened, { type: 'settings/setOpen', open: false }).settingsOpen).toBe(false);
  });

  it('stays open across project open/close (it is not project state)', () => {
    const withSettings = state({ projectId: 'p', settingsOpen: true });
    expect(
      appReducer(withSettings, {
        type: 'project/open',
        projectId: 'q',
        targeting: { pr: null, commit: null, path: null },
        layout: initialAppState.layout,
      }).settingsOpen,
    ).toBe(true);
    expect(appReducer(withSettings, { type: 'project/close' }).settingsOpen).toBe(true);
  });
});
