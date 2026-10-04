import { describe, expect, it } from 'vitest';
import { appReducer, initialAppState, type AppState } from '../src/state/reducer';

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

describe('opening the next file when ready', () => {
  it('switches to the files tab and stays pending until a file opens', () => {
    const pending = appReducer(state(), { type: 'file/openNextWhenReady' });
    expect(pending).toMatchObject({ mainTab: 'files', openNextFilePending: true });
    const opened = appReducer(pending, { type: 'file/open', path: 'a.ts' });
    expect(opened).toMatchObject({ activeFile: 'a.ts', openNextFilePending: false });
  });

  it('can be cancelled when there is nothing to open', () => {
    const pending = appReducer(state(), { type: 'file/openNextWhenReady' });
    expect(appReducer(pending, { type: 'file/openNextCancel' }).openNextFilePending).toBe(false);
  });

  it('forgets the previous checkout when the PR or commit changes, but not the path', () => {
    const checkout = { base: 'b', head: 'h' };
    const s = state({ targeting: { pr: 1, commit: null, path: null }, checkout });
    expect(appReducer(s, { type: 'target/pr', pr: 2 }).checkout).toBeNull();
    expect(appReducer(s, { type: 'target/commit', sha: 'abc' }).checkout).toBeNull();
    expect(appReducer(s, { type: 'target/path', path: 'src' }).checkout).toBe(checkout);
  });
});

describe('overview tab', () => {
  it('is the default main tab', () => {
    expect(initialAppState.mainTab).toBe('overview');
  });

  it('stays on the comments tab when the PR is cleared, to show the unassigned comments', () => {
    const s = state({ mainTab: 'comments', targeting: { pr: 7, commit: null, path: null } });
    expect(appReducer(s, { type: 'target/pr', pr: null }).mainTab).toBe('comments');
  });

  it('keeps the current tab when a PR is targeted or cleared from the files tab', () => {
    const s = state({ mainTab: 'files' });
    const targeted = appReducer(s, { type: 'target/pr', pr: 7 });
    expect(targeted.mainTab).toBe('files');
    expect(appReducer(targeted, { type: 'target/pr', pr: null }).mainTab).toBe('files');
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

describe('layout', () => {
  it('toggles the full file diff view via layout/setFullFileDiff', () => {
    const on = appReducer(state(), { type: 'layout/setFullFileDiff', full: true });
    expect(on.layout.fullFileDiff).toBe(true);
    expect(
      appReducer(on, { type: 'layout/setFullFileDiff', full: false }).layout.fullFileDiff,
    ).toBe(false);
  });

  it('toggles hiding viewed files via layout/setHideViewedFiles', () => {
    const hidden = appReducer(state(), { type: 'layout/setHideViewedFiles', hide: true });
    expect(hidden.layout.hideViewedFiles).toBe(true);
    expect(hidden.layout).toEqual({ ...initialAppState.layout, hideViewedFiles: true });
    const shown = appReducer(hidden, { type: 'layout/setHideViewedFiles', hide: false });
    expect(shown.layout.hideViewedFiles).toBe(false);
  });

  it('takes the persisted hide-viewed preference from the opened project', () => {
    const next = appReducer(state({ projectId: 'proj-a' }), {
      type: 'project/open',
      projectId: 'proj-b',
      targeting: { pr: null, commit: null, path: null },
      layout: { ...initialAppState.layout, hideViewedFiles: true },
    });
    expect(next.layout.hideViewedFiles).toBe(true);
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

describe('quick search popup', () => {
  it('opens in the requested mode and closes', () => {
    const file = appReducer(state(), { type: 'quickSearch/open', mode: 'file' });
    expect(file.quickSearch).toBe('file');
    expect(appReducer(file, { type: 'quickSearch/open', mode: 'navigate' }).quickSearch).toBe(
      'navigate',
    );
    expect(appReducer(file, { type: 'quickSearch/close' }).quickSearch).toBeNull();
  });

  it('is a no-op (same reference) when already in that mode or already closed', () => {
    const file = appReducer(state(), { type: 'quickSearch/open', mode: 'file' });
    expect(appReducer(file, { type: 'quickSearch/open', mode: 'file' })).toBe(file);
    const closed = state();
    expect(appReducer(closed, { type: 'quickSearch/close' })).toBe(closed);
  });

  it('is closed again when a project opens or closes', () => {
    const file = appReducer(state({ projectId: 'p' }), { type: 'quickSearch/open', mode: 'file' });
    expect(appReducer(file, { type: 'project/close' }).quickSearch).toBeNull();
  });
});

describe('layout wrap long lines', () => {
  it('sets the flag via layout/setWrapLongLines and defaults to off', () => {
    expect(initialAppState.layout.wrapLongLines).toBe(false);
    const on = appReducer(state(), { type: 'layout/setWrapLongLines', wrap: true });
    expect(on.layout.wrapLongLines).toBe(true);
    expect(
      appReducer(on, { type: 'layout/setWrapLongLines', wrap: false }).layout.wrapLongLines,
    ).toBe(false);
  });
});

describe('header status slice', () => {
  const message = { id: 'test.status', defaultMessage: 'Status' };

  it('publishes a message with a new id each time', () => {
    const first = appReducer(state(), { type: 'headerStatus/publish', message });
    const second = appReducer(first, { type: 'headerStatus/publish', message });
    expect(first.headerStatus?.message).toBe(message);
    expect(second.headerStatus?.id).toBeGreaterThan(first.headerStatus?.id ?? 0);
  });

  it('clears only the matching message', () => {
    const published = appReducer(state(), { type: 'headerStatus/publish', message });
    const id = published.headerStatus?.id ?? 0;
    expect(appReducer(published, { type: 'headerStatus/clear', id: id + 1 })).toBe(published);
    expect(appReducer(published, { type: 'headerStatus/clear', id }).headerStatus).toBeNull();
  });

  it('survives closing the project', () => {
    const published = appReducer(state(), { type: 'headerStatus/publish', message });
    expect(appReducer(published, { type: 'project/close' }).headerStatus).toEqual(
      published.headerStatus,
    );
  });
});
