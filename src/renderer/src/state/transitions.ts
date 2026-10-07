import type { DiffSide } from '@gepard/common';
import { nextTargetedFile } from '../helpers/targetedFiles';
import type { AppState, Layout, Targeting } from './reducer';

export function sameCheckoutHead(
  a: AppState['checkoutHead'],
  b: AppState['checkoutHead'],
): boolean {
  if (a === null || b === null) return a === b;
  return a.base === b.base && a.head === b.head;
}

function samePosition(
  a: Layout['fileControlsPosition'],
  b: Layout['fileControlsPosition'],
): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y;
}

export function withLayout(state: AppState, layout: Layout): AppState {
  const prev = state.layout;
  const same =
    prev.sidePanelWidth === layout.sidePanelWidth &&
    prev.fileCommentsPanelWidth === layout.fileCommentsPanelWidth &&
    prev.fileCommentsPanelOpen === layout.fileCommentsPanelOpen &&
    prev.hideViewedFiles === layout.hideViewedFiles &&
    prev.fileControlsDocked === layout.fileControlsDocked &&
    samePosition(prev.fileControlsPosition, layout.fileControlsPosition) &&
    prev.wrapLongLines === layout.wrapLongLines &&
    prev.fullFileDiff === layout.fullFileDiff;
  return same ? state : { ...state, layout };
}

export function withTarget(state: AppState, targeting: Targeting, set: boolean): AppState {
  return {
    ...state,
    targeting,
    sidePanelTab: set ? 'targeted' : state.sidePanelTab,
    acceptedFiles: [],
  };
}

export function openFile(
  state: AppState,
  path: string,
  line?: number | null,
  side?: DiffSide,
): AppState {
  const revealLine = line != null ? { line, side: side ?? ('RIGHT' as const) } : null;
  if (
    state.activeFile === path &&
    state.mainTab === 'files' &&
    state.revealLine === null &&
    revealLine === null &&
    (state.pinnedFiles.includes(path) || state.previewFile === path)
  ) {
    return state;
  }
  return state.pinnedFiles.includes(path)
    ? { ...state, activeFile: path, mainTab: 'files', revealLine }
    : { ...state, previewFile: path, activeFile: path, mainTab: 'files', revealLine };
}

export function closeFile(state: AppState, path: string): AppState {
  if (
    !state.pinnedFiles.includes(path) &&
    state.previewFile !== path &&
    state.activeFile !== path &&
    state.revealLine === null
  ) {
    return state;
  }
  const pinnedFiles = state.pinnedFiles.filter((p) => p !== path);
  const previewFile = state.previewFile === path ? null : state.previewFile;
  const activeFile =
    state.activeFile === path ? (previewFile ?? pinnedFiles.at(-1) ?? null) : state.activeFile;
  return { ...state, pinnedFiles, previewFile, activeFile, revealLine: null };
}

export function acceptFile(state: AppState, path: string): AppState {
  if (state.acceptedFiles.at(-1) === path) return state;
  return {
    ...state,
    acceptedFiles: [...state.acceptedFiles.filter((p) => p !== path), path],
  };
}

export function stepFile(
  state: AppState,
  targeted: readonly string[],
  skip: ReadonlySet<string>,
  direction: 1 | -1,
): AppState {
  const next = nextTargetedFile(targeted, state.activeFile, skip, direction);
  return next === null ? state : openFile(state, next);
}
