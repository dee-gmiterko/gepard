import { describe, expect, it } from 'vitest';
import { uiReducer, initialUiState, type UiState } from '../../src/state/reducer';

function state(overrides: Partial<UiState> = {}): UiState {
  return { ...initialUiState, ...overrides };
}

describe('targeting behaviors', () => {
  it('changing the PR clears the commit and switches the side panel to targeted', () => {
    const withCommit = state({ targeting: { pr: null, commit: 'deadbeef', path: null } });
    const next = uiReducer(withCommit, { type: 'target/pr', pr: 7 });
    expect(next.targeting).toEqual({ pr: 7, commit: null, path: null });
    expect(next.sidePanelTab).toBe('targeted');
  });

  it('clearing the PR (pr: null) does not force the side panel to targeted', () => {
    const withPr = state({
      targeting: { pr: 7, commit: null, path: null },
      sidePanelTab: 'search',
    });
    const next = uiReducer(withPr, { type: 'target/pr', pr: null });
    expect(next.targeting.pr).toBeNull();
    expect(next.sidePanelTab).toBe('search');
  });

  it('setting a commit or a path target also switches to the targeted panel', () => {
    const s = state({ sidePanelTab: 'files' });
    expect(uiReducer(s, { type: 'target/commit', sha: 'abc123' }).sidePanelTab).toBe('targeted');
    expect(uiReducer(s, { type: 'target/path', path: 'src' }).sidePanelTab).toBe('targeted');
  });

  it('is a no-op (same reference) when the target does not actually change', () => {
    const s = state({ targeting: { pr: 7, commit: null, path: null } });
    expect(uiReducer(s, { type: 'target/pr', pr: 7 })).toBe(s);
  });
});

describe('opening the first file of a review', () => {
  const targeting = { pr: 7, commit: null, path: null };

  it('opens the file when the review is still showing', () => {
    const s = state({ targeting, mainTab: 'files' });
    const next = uiReducer(s, { type: 'review/openFile', targeting, path: 'a.ts' });
    expect(next).toMatchObject({ activeFile: 'a.ts', previewFile: 'a.ts', mainTab: 'files' });
  });

  it('is ignored once the target changed or the files tab was left', () => {
    const otherPr = state({ targeting: { ...targeting, pr: 8 }, mainTab: 'files' });
    expect(uiReducer(otherPr, { type: 'review/openFile', targeting, path: 'a.ts' })).toBe(otherPr);
    const overview = state({ targeting, mainTab: 'overview' });
    expect(uiReducer(overview, { type: 'review/openFile', targeting, path: 'a.ts' })).toBe(
      overview,
    );
  });

  it('forgets the previous checkoutHead when the PR or commit changes, but not the path', () => {
    const checkoutHead = { base: 'b', head: 'h' };
    const s = state({ targeting: { pr: 1, commit: null, path: null }, checkoutHead });
    expect(uiReducer(s, { type: 'target/pr', pr: 2 }).checkoutHead).toBeNull();
    expect(uiReducer(s, { type: 'target/commit', sha: 'abc' }).checkoutHead).toBeNull();
    expect(uiReducer(s, { type: 'target/path', path: 'src' }).checkoutHead).toBe(checkoutHead);
  });
});

describe('overview tab', () => {
  it('is the default main tab', () => {
    expect(initialUiState.mainTab).toBe('overview');
  });

  it('stays on the comments tab when the PR is cleared, to show the unassigned comments', () => {
    const s = state({ mainTab: 'comments', targeting: { pr: 7, commit: null, path: null } });
    expect(uiReducer(s, { type: 'target/pr', pr: null }).mainTab).toBe('comments');
  });

  it('keeps the current tab when a PR is targeted or cleared from the files tab', () => {
    const s = state({ mainTab: 'files' });
    const targeted = uiReducer(s, { type: 'target/pr', pr: 7 });
    expect(targeted.mainTab).toBe('files');
    expect(uiReducer(targeted, { type: 'target/pr', pr: null }).mainTab).toBe('files');
  });
});

describe('opening a project', () => {
  it('resets everything, including pinned files', () => {
    const s = state({ pinnedFiles: ['a.ts'], projectId: 'proj-a' });
    const next = uiReducer(s, {
      type: 'project/open',
      projectId: 'proj-b',
      targeting: { pr: null, commit: null, path: null },
      layout: initialUiState.layout,
    });
    expect(next).toEqual({ ...initialUiState, projectId: 'proj-b' });
  });

  it('applies its persisted targeting in the same dispatch and switches to the targeted panel', () => {
    const s = state({ pinnedFiles: ['a.ts'], projectId: 'proj-a' });
    const next = uiReducer(s, {
      type: 'project/open',
      projectId: 'proj-b',
      targeting: { pr: 7, commit: 'deadbeef', path: 'src' },
      layout: initialUiState.layout,
    });
    expect(next.targeting).toEqual({ pr: 7, commit: 'deadbeef', path: 'src' });
    expect(next.sidePanelTab).toBe('targeted');
    expect(next.pinnedFiles).toEqual([]);
  });

  it('does not force the side panel to targeted when there is no persisted targeting', () => {
    const s = state({ projectId: 'proj-a' });
    const next = uiReducer(s, {
      type: 'project/open',
      projectId: 'proj-b',
      targeting: { pr: null, commit: null, path: null },
      layout: initialUiState.layout,
    });
    expect(next.sidePanelTab).toBe('files');
  });
});

describe('pinned files', () => {
  it('are preserved across target changes', () => {
    const s = state({ pinnedFiles: ['a.ts', 'b.ts'] });
    const next = uiReducer(s, { type: 'target/pr', pr: 3 });
    expect(next.pinnedFiles).toEqual(['a.ts', 'b.ts']);
  });
});

describe('preview file', () => {
  it('opening a non-pinned file sets it as both the preview and the active file', () => {
    const next = uiReducer(state(), { type: 'file/open', path: 'a.ts' });
    expect(next.previewFile).toBe('a.ts');
    expect(next.activeFile).toBe('a.ts');
  });

  it('opening another non-pinned file replaces the previous preview file', () => {
    const withPreview = state({ previewFile: 'a.ts', activeFile: 'a.ts' });
    const next = uiReducer(withPreview, { type: 'file/open', path: 'b.ts' });
    expect(next.previewFile).toBe('b.ts');
    expect(next.activeFile).toBe('b.ts');
  });

  it('opening a pinned file activates it without touching the preview slot', () => {
    const withPreview = state({
      pinnedFiles: ['pinned.ts'],
      previewFile: 'a.ts',
      activeFile: 'a.ts',
    });
    const next = uiReducer(withPreview, { type: 'file/open', path: 'pinned.ts' });
    expect(next.activeFile).toBe('pinned.ts');
    expect(next.previewFile).toBe('a.ts');
  });

  it('pinning the currently previewed file clears the preview slot', () => {
    const s = state({ previewFile: 'a.ts', activeFile: 'a.ts' });
    const next = uiReducer(s, { type: 'file/pin', path: 'a.ts' });
    expect(next.pinnedFiles).toEqual(['a.ts']);
    expect(next.previewFile).toBeNull();
  });

  it('unpinning the active file falls back to the preview file, then the last pinned file', () => {
    const withPreview = state({
      pinnedFiles: ['a.ts', 'b.ts'],
      activeFile: 'a.ts',
      previewFile: 'preview.ts',
    });
    expect(uiReducer(withPreview, { type: 'file/unpin', path: 'a.ts' }).activeFile).toBe(
      'preview.ts',
    );

    const withoutPreview = state({
      pinnedFiles: ['a.ts', 'b.ts'],
      activeFile: 'a.ts',
      previewFile: null,
    });
    const next = uiReducer(withoutPreview, { type: 'file/unpin', path: 'a.ts' });
    expect(next.pinnedFiles).toEqual(['b.ts']);
    expect(next.activeFile).toBe('b.ts');
  });
});

describe('layout', () => {
  it('toggles the full file diff view via layout/setFullFileDiff', () => {
    const on = uiReducer(state(), { type: 'layout/setFullFileDiff', full: true });
    expect(on.layout.fullFileDiff).toBe(true);
    expect(uiReducer(on, { type: 'layout/setFullFileDiff', full: false }).layout.fullFileDiff).toBe(
      false,
    );
  });

  it('toggles hiding viewed files via layout/setHideViewedFiles', () => {
    const hidden = uiReducer(state(), { type: 'layout/setHideViewedFiles', hide: true });
    expect(hidden.layout.hideViewedFiles).toBe(true);
    expect(hidden.layout).toEqual({ ...initialUiState.layout, hideViewedFiles: true });
    const shown = uiReducer(hidden, { type: 'layout/setHideViewedFiles', hide: false });
    expect(shown.layout.hideViewedFiles).toBe(false);
  });

  it('takes the persisted hide-viewed preference from the opened project', () => {
    const next = uiReducer(state({ projectId: 'proj-a' }), {
      type: 'project/open',
      projectId: 'proj-b',
      targeting: { pr: null, commit: null, path: null },
      layout: { ...initialUiState.layout, hideViewedFiles: true },
    });
    expect(next.layout.hideViewedFiles).toBe(true);
  });
});

describe('toast slice', () => {
  const toast = (id: string): UiState['toasts'][number] => ({
    id,
    tone: 'danger',
    message: `failure ${id}`,
  });

  it('pushes in order and dismisses by id', () => {
    let s = uiReducer(state(), { type: 'toast/push', toast: toast('1') });
    s = uiReducer(s, { type: 'toast/push', toast: toast('2') });
    expect(s.toasts.map((t) => t.id)).toEqual(['1', '2']);
    s = uiReducer(s, { type: 'toast/dismiss', id: '1' });
    expect(s.toasts.map((t) => t.id)).toEqual(['2']);
  });

  it('keeps toasts across project open/close (they are not project state)', () => {
    const withToast = state({ projectId: 'p', toasts: [toast('1')] });
    expect(
      uiReducer(withToast, {
        type: 'project/open',
        projectId: 'q',
        targeting: { pr: null, commit: null, path: null },
        layout: initialUiState.layout,
      }).toasts,
    ).toEqual([toast('1')]);
    expect(uiReducer(withToast, { type: 'project/close' }).toasts).toEqual([toast('1')]);
  });
});

describe('settings overlay', () => {
  it('opens and closes via settings/setOpen', () => {
    const opened = uiReducer(state(), { type: 'settings/setOpen', open: true });
    expect(opened.settingsOpen).toBe(true);
    expect(uiReducer(opened, { type: 'settings/setOpen', open: false }).settingsOpen).toBe(false);
  });

  it('stays open across project open/close (it is not project state)', () => {
    const withSettings = state({ projectId: 'p', settingsOpen: true });
    expect(
      uiReducer(withSettings, {
        type: 'project/open',
        projectId: 'q',
        targeting: { pr: null, commit: null, path: null },
        layout: initialUiState.layout,
      }).settingsOpen,
    ).toBe(true);
    expect(uiReducer(withSettings, { type: 'project/close' }).settingsOpen).toBe(true);
  });
});

describe('quick search popup', () => {
  it('opens in the requested mode and closes', () => {
    const file = uiReducer(state(), { type: 'quickSearch/open', mode: 'file' });
    expect(file.quickSearch).toBe('file');
    expect(uiReducer(file, { type: 'quickSearch/open', mode: 'navigate' }).quickSearch).toBe(
      'navigate',
    );
    expect(uiReducer(file, { type: 'quickSearch/close' }).quickSearch).toBeNull();
  });

  it('is a no-op (same reference) when already in that mode or already closed', () => {
    const file = uiReducer(state(), { type: 'quickSearch/open', mode: 'file' });
    expect(uiReducer(file, { type: 'quickSearch/open', mode: 'file' })).toBe(file);
    const closed = state();
    expect(uiReducer(closed, { type: 'quickSearch/close' })).toBe(closed);
  });

  it('is closed again when a project opens or closes', () => {
    const file = uiReducer(state({ projectId: 'p' }), { type: 'quickSearch/open', mode: 'file' });
    expect(uiReducer(file, { type: 'project/close' }).quickSearch).toBeNull();
  });
});

describe('layout wrap long lines', () => {
  it('sets the flag via layout/setWrapLongLines and defaults to off', () => {
    expect(initialUiState.layout.wrapLongLines).toBe(false);
    const on = uiReducer(state(), { type: 'layout/setWrapLongLines', wrap: true });
    expect(on.layout.wrapLongLines).toBe(true);
    expect(
      uiReducer(on, { type: 'layout/setWrapLongLines', wrap: false }).layout.wrapLongLines,
    ).toBe(false);
  });
});

describe('header status slice', () => {
  const message = { id: 'test.status', defaultMessage: 'Status' };

  it('publishes a message with a new id each time', () => {
    const first = uiReducer(state(), { type: 'headerStatus/publish', message });
    const second = uiReducer(first, { type: 'headerStatus/publish', message });
    expect(first.headerStatus?.message).toBe(message);
    expect(second.headerStatus?.id).toBeGreaterThan(first.headerStatus?.id ?? 0);
  });

  it('clears only the matching message', () => {
    const published = uiReducer(state(), { type: 'headerStatus/publish', message });
    const id = published.headerStatus?.id ?? 0;
    expect(uiReducer(published, { type: 'headerStatus/clear', id: id + 1 })).toBe(published);
    expect(uiReducer(published, { type: 'headerStatus/clear', id }).headerStatus).toBeNull();
  });

  it('survives closing the project', () => {
    const published = uiReducer(state(), { type: 'headerStatus/publish', message });
    expect(uiReducer(published, { type: 'project/close' }).headerStatus).toEqual(
      published.headerStatus,
    );
  });
});

describe('no-op transitions keep the same state', () => {
  const same = (before: UiState, action: Parameters<typeof uiReducer>[1]): void => {
    expect(uiReducer(before, action)).toBe(before);
  };

  it('returns the same state when nothing changes', () => {
    same(state(), { type: 'mainTab/set', tab: 'overview' });
    same(state(), { type: 'settings/setOpen', open: false });
    same(state(), { type: 'sidePanel/setTab', tab: 'files' });
    same(state(), {
      type: 'layout/setSidePanelWidth',
      width: initialUiState.layout.sidePanelWidth,
    });
    same(state(), { type: 'layout/setFileControlsPosition', position: null });
    same(state(), { type: 'file/revert' });
    same(state(), { type: 'toast/dismiss', id: 'missing' });
    same(state(), { type: 'target/checkoutHeadResult', checkoutHead: null });
    same(state(), { type: 'file/close', path: 'a.ts' });
  });

  it('returns the same state when a file is already open, focused or accepted', () => {
    const open = uiReducer(state(), { type: 'file/open', path: 'a.ts' });
    same(open, { type: 'file/open', path: 'a.ts' });
    same(open, { type: 'file/focus', path: 'a.ts' });
    const accepted = uiReducer(open, { type: 'file/accept', path: 'a.ts' });
    same(accepted, { type: 'file/accept', path: 'a.ts' });
  });

  it('returns the same state for an equal checkoutHead and an equal control position', () => {
    const checkoutHead = { base: 'b', head: 'h' };
    const on = uiReducer(state(), { type: 'target/checkoutHeadResult', checkoutHead });
    same(on, { type: 'target/checkoutHeadResult', checkoutHead: { ...checkoutHead } });
    const moved = uiReducer(state(), {
      type: 'layout/setFileControlsPosition',
      position: { x: 1, y: 2 },
    });
    same(moved, { type: 'layout/setFileControlsPosition', position: { x: 1, y: 2 } });
  });

  it('still changes state when the sidebar is asked to take focus', () => {
    const next = uiReducer(state(), { type: 'sidePanel/setTab', tab: 'files', focus: true });
    expect(next.sidePanelFocusRequest).toBe(1);
  });
});
