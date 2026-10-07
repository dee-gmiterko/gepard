import { z } from 'zod';
import type { MessageDescriptor } from 'react-intl';
import type { DiffSide } from '@gepard/common';
import type { ReportTone } from '../errors/report';
import { nextTargetedFile } from '../helpers/targetedFiles';

export const SidePanelTab = z.enum(['files', 'targeted', 'search']);
export type SidePanelTab = z.infer<typeof SidePanelTab>;
export const MainTab = z.enum(['overview', 'files', 'comments']);
export type MainTab = z.infer<typeof MainTab>;
export const QuickSearchMode = z.enum(['file', 'navigate']);
export type QuickSearchMode = z.infer<typeof QuickSearchMode>;

export interface Toast {
  id: string;
  tone: ReportTone;
  message: string;
  detail?: string;
}

export interface HeaderStatus {
  id: number;
  message: MessageDescriptor;
}

export interface ReviewFiles {
  targeted: string[];
  changed: string[];
  viewed: string[];
}

export interface ViewedRequest {
  id: number;
  paths: string[];
  viewed: boolean;
}

export interface Targeting {
  pr: number | null;
  commit: string | null;
  path: string | null;
}

export interface Layout {
  sidePanelWidth: number;
  fileCommentsPanelWidth: number;
  fileCommentsPanelOpen: boolean;
  hideViewedFiles: boolean;
  fileControlsDocked: boolean;
  fileControlsPosition: { x: number; y: number } | null;
  wrapLongLines: boolean;
  fullFileDiff: boolean;
}

export const defaultLayout: Layout = {
  sidePanelWidth: 300,
  fileCommentsPanelWidth: 300,
  fileCommentsPanelOpen: false,
  hideViewedFiles: false,
  fileControlsDocked: false,
  fileControlsPosition: null,
  wrapLongLines: false,
  fullFileDiff: false,
};

export interface AppState {
  projectId: string | null;
  targeting: Targeting;
  layout: Layout;
  sidePanelTab: SidePanelTab;
  sidePanelFocusRequest: number;
  pinnedFiles: string[];
  acceptedFiles: string[];
  previewFile: string | null;
  activeFile: string | null;
  mainTab: MainTab;
  checkout: { base: string; head: string } | null;
  toasts: Toast[];
  headerStatus: HeaderStatus | null;
  revealLine: { line: number; side: DiffSide } | null;
  settingsOpen: boolean;
  quickSearch: QuickSearchMode | null;
  reviewFiles: ReviewFiles;
  viewedQueue: ViewedRequest[];
}

export const initialAppState: AppState = {
  projectId: null,
  targeting: { pr: null, commit: null, path: null },
  layout: defaultLayout,
  sidePanelTab: 'files',
  sidePanelFocusRequest: 0,
  pinnedFiles: [],
  acceptedFiles: [],
  previewFile: null,
  activeFile: null,
  mainTab: 'overview',
  checkout: null,
  toasts: [],
  headerStatus: null,
  revealLine: null,
  settingsOpen: false,
  quickSearch: null,
  reviewFiles: { targeted: [], changed: [], viewed: [] },
  viewedQueue: [],
};

export type AppAction =
  | { type: 'project/open'; projectId: string; targeting: Targeting; layout: Layout }
  | { type: 'project/close' }
  | { type: 'target/pr'; pr: number | null }
  | { type: 'target/commit'; sha: string | null }
  | { type: 'target/path'; path: string | null }
  | {
      type: 'target/checkoutResult';
      checkout: { base: string; head: string } | null;
      for?: { pr: number | null; commit: string | null };
    }
  | { type: 'sidePanel/setTab'; tab: SidePanelTab; focus?: boolean }
  | { type: 'layout/setSidePanelWidth'; width: number }
  | { type: 'layout/setFileCommentsPanelWidth'; width: number }
  | { type: 'layout/setFileCommentsPanelOpen'; open: boolean }
  | { type: 'layout/setHideViewedFiles'; hide: boolean }
  | { type: 'layout/setFileControlsDocked'; docked: boolean }
  | { type: 'layout/setFileControlsPosition'; position: { x: number; y: number } | null }
  | { type: 'layout/setWrapLongLines'; wrap: boolean }
  | { type: 'layout/setFullFileDiff'; full: boolean }
  | { type: 'file/open'; path: string; line?: number | null; side?: DiffSide }
  | { type: 'file/focus'; path: string }
  | { type: 'file/pin'; path: string }
  | { type: 'file/unpin'; path: string }
  | { type: 'file/close'; path: string }
  | { type: 'file/accept'; path: string }
  | { type: 'file/revert' }
  | { type: 'review/openFile'; targeting: Pick<Targeting, 'pr' | 'commit'>; path: string }
  | { type: 'mainTab/set'; tab: MainTab }
  | { type: 'toast/push'; toast: Toast }
  | { type: 'toast/dismiss'; id: string }
  | { type: 'headerStatus/publish'; message: MessageDescriptor }
  | { type: 'headerStatus/clear'; id: number }
  | { type: 'settings/setOpen'; open: boolean }
  | { type: 'quickSearch/open'; mode: QuickSearchMode }
  | { type: 'quickSearch/close' }
  | { type: 'review/sync'; files: ReviewFiles }
  | { type: 'viewed/mark'; paths: string[]; viewed: boolean }
  | { type: 'viewed/toggle'; path?: string | null }
  | { type: 'viewed/done'; id: number }
  | { type: 'file/step'; direction: 1 | -1 }
  | { type: 'review/acceptNext' }
  | { type: 'review/revertPrev' };

export function canMarkViewed(
  state: Pick<AppState, 'targeting' | 'reviewFiles'>,
  path: string | null,
): path is string {
  return state.targeting.pr !== null && path !== null && state.reviewFiles.changed.includes(path);
}

function sameCheckout(a: AppState['checkout'], b: AppState['checkout']): boolean {
  if (a === null || b === null) return a === b;
  return a.base === b.base && a.head === b.head;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function markViewed(state: AppState, paths: string[], viewed: boolean): AppState {
  const marked = new Set(state.reviewFiles.viewed);
  for (const path of paths) {
    if (viewed) marked.add(path);
    else marked.delete(path);
  }
  const request = { id: (state.viewedQueue.at(-1)?.id ?? 0) + 1, paths, viewed };
  return {
    ...state,
    reviewFiles: { ...state.reviewFiles, viewed: [...marked] },
    viewedQueue: [...state.viewedQueue, request],
  };
}

function stepFile(
  state: AppState,
  direction: 1 | -1,
  skip: ReadonlySet<string> = new Set(state.reviewFiles.viewed),
): AppState {
  const next = nextTargetedFile(state.reviewFiles.targeted, state.activeFile, skip, direction);
  return next === null ? state : appReducer(state, { type: 'file/open', path: next });
}

function withTarget(state: AppState, targeting: Targeting, set: boolean): AppState {
  return {
    ...state,
    targeting,
    sidePanelTab: set ? 'targeted' : state.sidePanelTab,
    acceptedFiles: [],
  };
}

function samePosition(
  a: Layout['fileControlsPosition'],
  b: Layout['fileControlsPosition'],
): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y;
}

function withLayout(state: AppState, layout: Layout): AppState {
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

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'project/open': {
      if (state.projectId === action.projectId) return state;
      const opened = {
        ...initialAppState,
        projectId: action.projectId,
        layout: action.layout,
        toasts: state.toasts,
        headerStatus: state.headerStatus,
        settingsOpen: state.settingsOpen,
      };
      const { pr, commit, path } = action.targeting;
      return withTarget(opened, action.targeting, pr !== null || commit !== null || path !== null);
    }
    case 'project/close':
      return {
        ...initialAppState,
        toasts: state.toasts,
        headerStatus: state.headerStatus,
        settingsOpen: state.settingsOpen,
      };
    case 'target/pr':
      if (state.targeting.pr === action.pr) return state;
      return {
        ...withTarget(
          state,
          { ...state.targeting, pr: action.pr, commit: null },
          action.pr !== null,
        ),
        checkout: null,
      };
    case 'target/commit':
      if (state.targeting.commit === action.sha) return state;
      return {
        ...withTarget(state, { ...state.targeting, commit: action.sha }, action.sha !== null),
        checkout: null,
      };
    case 'target/path':
      if (state.targeting.path === action.path) return state;
      return withTarget(state, { ...state.targeting, path: action.path }, action.path !== null);
    case 'target/checkoutResult':
      if (
        action.for &&
        (action.for.pr !== state.targeting.pr || action.for.commit !== state.targeting.commit)
      ) {
        return state;
      }
      if (sameCheckout(state.checkout, action.checkout)) return state;
      return { ...state, checkout: action.checkout };
    case 'sidePanel/setTab':
      if (state.sidePanelTab === action.tab && !action.focus) return state;
      return {
        ...state,
        sidePanelTab: action.tab,
        sidePanelFocusRequest: action.focus
          ? state.sidePanelFocusRequest + 1
          : state.sidePanelFocusRequest,
      };
    case 'layout/setSidePanelWidth':
      return withLayout(state, { ...state.layout, sidePanelWidth: action.width });
    case 'layout/setFileCommentsPanelWidth':
      return withLayout(state, { ...state.layout, fileCommentsPanelWidth: action.width });
    case 'layout/setFileCommentsPanelOpen':
      return withLayout(state, { ...state.layout, fileCommentsPanelOpen: action.open });
    case 'layout/setHideViewedFiles':
      return withLayout(state, { ...state.layout, hideViewedFiles: action.hide });
    case 'layout/setFileControlsDocked':
      return withLayout(state, { ...state.layout, fileControlsDocked: action.docked });
    case 'layout/setFileControlsPosition':
      return withLayout(state, { ...state.layout, fileControlsPosition: action.position });
    case 'layout/setWrapLongLines':
      return withLayout(state, { ...state.layout, wrapLongLines: action.wrap });
    case 'layout/setFullFileDiff':
      return withLayout(state, { ...state.layout, fullFileDiff: action.full });
    case 'file/open': {
      const revealLine =
        action.line != null ? { line: action.line, side: action.side ?? ('RIGHT' as const) } : null;
      if (
        state.activeFile === action.path &&
        state.mainTab === 'files' &&
        state.revealLine === null &&
        revealLine === null &&
        (state.pinnedFiles.includes(action.path) || state.previewFile === action.path)
      ) {
        return state;
      }
      return state.pinnedFiles.includes(action.path)
        ? { ...state, activeFile: action.path, mainTab: 'files', revealLine }
        : {
            ...state,
            previewFile: action.path,
            activeFile: action.path,
            mainTab: 'files',
            revealLine,
          };
    }
    case 'file/focus':
      if (
        state.activeFile === action.path &&
        state.mainTab === 'files' &&
        state.revealLine === null
      ) {
        return state;
      }
      return { ...state, activeFile: action.path, mainTab: 'files', revealLine: null };
    case 'file/pin':
      if (state.pinnedFiles.includes(action.path)) return state;
      return {
        ...state,
        pinnedFiles: [...state.pinnedFiles, action.path],
        previewFile: state.previewFile === action.path ? null : state.previewFile,
      };
    case 'file/unpin': {
      if (!state.pinnedFiles.includes(action.path)) return state;
      const pinnedFiles = state.pinnedFiles.filter((p) => p !== action.path);
      const activeFile =
        state.activeFile === action.path
          ? (state.previewFile ?? pinnedFiles.at(-1) ?? null)
          : state.activeFile;
      return { ...state, pinnedFiles, activeFile, revealLine: null };
    }
    case 'file/close': {
      if (
        !state.pinnedFiles.includes(action.path) &&
        state.previewFile !== action.path &&
        state.activeFile !== action.path &&
        state.revealLine === null
      ) {
        return state;
      }
      const pinnedFiles = state.pinnedFiles.filter((p) => p !== action.path);
      const previewFile = state.previewFile === action.path ? null : state.previewFile;
      const activeFile =
        state.activeFile === action.path
          ? (previewFile ?? pinnedFiles.at(-1) ?? null)
          : state.activeFile;
      return { ...state, pinnedFiles, previewFile, activeFile, revealLine: null };
    }
    case 'file/accept':
      if (state.acceptedFiles.at(-1) === action.path) return state;
      return {
        ...state,
        acceptedFiles: [...state.acceptedFiles.filter((p) => p !== action.path), action.path],
      };
    case 'file/revert':
      if (state.acceptedFiles.length === 0) return state;
      return { ...state, acceptedFiles: state.acceptedFiles.slice(0, -1) };
    case 'review/openFile':
      // Its file list loads asynchronously, so the review may have been left in the meantime.
      if (
        state.mainTab !== 'files' ||
        state.targeting.pr !== action.targeting.pr ||
        state.targeting.commit !== action.targeting.commit
      ) {
        return state;
      }
      return appReducer(state, { type: 'file/open', path: action.path });
    case 'mainTab/set':
      if (state.mainTab === action.tab) return state;
      return { ...state, mainTab: action.tab };
    case 'toast/push':
      return { ...state, toasts: [...state.toasts, action.toast] };
    case 'toast/dismiss':
      if (!state.toasts.some((t) => t.id === action.id)) return state;
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'headerStatus/publish':
      return {
        ...state,
        headerStatus: { id: (state.headerStatus?.id ?? 0) + 1, message: action.message },
      };
    case 'headerStatus/clear':
      if (state.headerStatus?.id !== action.id) return state;
      return { ...state, headerStatus: null };
    case 'settings/setOpen':
      if (state.settingsOpen === action.open) return state;
      return { ...state, settingsOpen: action.open };
    case 'quickSearch/open':
      if (state.quickSearch === action.mode) return state;
      return { ...state, quickSearch: action.mode };
    case 'quickSearch/close':
      if (state.quickSearch === null) return state;
      return { ...state, quickSearch: null };
    case 'review/sync': {
      const { targeted, changed, viewed } = state.reviewFiles;
      const files = action.files;
      if (
        sameList(targeted, files.targeted) &&
        sameList(changed, files.changed) &&
        sameList(viewed, files.viewed)
      ) {
        return state;
      }
      return { ...state, reviewFiles: files };
    }
    case 'viewed/mark': {
      if (state.targeting.pr === null) return state;
      const marked = markViewed(state, action.paths, action.viewed);
      const { activeFile, layout } = state;
      if (
        action.viewed &&
        layout.hideViewedFiles &&
        activeFile !== null &&
        action.paths.includes(activeFile)
      ) {
        return stepFile(marked, 1);
      }
      return marked;
    }
    case 'viewed/toggle': {
      const path = action.path === undefined ? state.activeFile : action.path;
      if (!canMarkViewed(state, path)) return state;
      return appReducer(state, {
        type: 'viewed/mark',
        paths: [path],
        viewed: !state.reviewFiles.viewed.includes(path),
      });
    }
    case 'viewed/done':
      if (!state.viewedQueue.some((r) => r.id === action.id)) return state;
      return { ...state, viewedQueue: state.viewedQueue.filter((r) => r.id !== action.id) };
    case 'file/step':
      return stepFile(state, action.direction);
    case 'review/acceptNext': {
      const path = state.activeFile;
      if (path === null) return state;
      const accepted = canMarkViewed(state, path)
        ? appReducer(markViewed(state, [path], true), { type: 'file/accept', path })
        : state;
      const moved = stepFile(accepted, 1);
      return moved === accepted ? appReducer(accepted, { type: 'file/close', path }) : moved;
    }
    case 'review/revertPrev': {
      const path = state.acceptedFiles.at(-1);
      if (path === undefined) return state;
      const reverted = appReducer(state, { type: 'file/revert' });
      const unmarked = state.targeting.pr !== null ? markViewed(reverted, [path], false) : reverted;
      return appReducer(unmarked, { type: 'file/open', path });
    }
    default:
      return state;
  }
}
