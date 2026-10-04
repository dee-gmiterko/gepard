import { z } from 'zod';
import type { MessageDescriptor } from 'react-intl';
import type { DiffSide } from '@gepard/common';
import type { ReportTone } from '../errors/report';

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
  /** Open the next unviewed targeted file once the target's files have loaded. */
  openNextFilePending: boolean;
  mainTab: MainTab;
  checkout: { base: string; head: string } | null;
  toasts: Toast[];
  headerStatus: HeaderStatus | null;
  revealLine: { line: number; side: DiffSide } | null;
  settingsOpen: boolean;
  quickSearch: QuickSearchMode | null;
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
  openNextFilePending: false,
  mainTab: 'overview',
  checkout: null,
  toasts: [],
  headerStatus: null,
  revealLine: null,
  settingsOpen: false,
  quickSearch: null,
};

export type AppAction =
  | { type: 'project/open'; projectId: string; targeting: Targeting; layout: Layout }
  | { type: 'project/close' }
  | { type: 'target/pr'; pr: number | null }
  | { type: 'target/commit'; sha: string | null }
  | { type: 'target/path'; path: string | null }
  | { type: 'target/checkoutResult'; checkout: { base: string; head: string } | null }
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
  | { type: 'file/openNextWhenReady' }
  | { type: 'file/openNextCancel' }
  | { type: 'mainTab/set'; tab: MainTab }
  | { type: 'toast/push'; toast: Toast }
  | { type: 'toast/dismiss'; id: string }
  | { type: 'headerStatus/publish'; message: MessageDescriptor }
  | { type: 'headerStatus/clear'; id: number }
  | { type: 'settings/setOpen'; open: boolean }
  | { type: 'quickSearch/open'; mode: QuickSearchMode }
  | { type: 'quickSearch/close' };

function withTarget(state: AppState, targeting: Targeting, set: boolean): AppState {
  return {
    ...state,
    targeting,
    sidePanelTab: set ? 'targeted' : state.sidePanelTab,
    acceptedFiles: [],
  };
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
      return { ...state, checkout: action.checkout };
    case 'sidePanel/setTab':
      return {
        ...state,
        sidePanelTab: action.tab,
        sidePanelFocusRequest: action.focus
          ? state.sidePanelFocusRequest + 1
          : state.sidePanelFocusRequest,
      };
    case 'layout/setSidePanelWidth':
      return { ...state, layout: { ...state.layout, sidePanelWidth: action.width } };
    case 'layout/setFileCommentsPanelWidth':
      return { ...state, layout: { ...state.layout, fileCommentsPanelWidth: action.width } };
    case 'layout/setFileCommentsPanelOpen':
      return { ...state, layout: { ...state.layout, fileCommentsPanelOpen: action.open } };
    case 'layout/setHideViewedFiles':
      return { ...state, layout: { ...state.layout, hideViewedFiles: action.hide } };
    case 'layout/setFileControlsDocked':
      return { ...state, layout: { ...state.layout, fileControlsDocked: action.docked } };
    case 'layout/setFileControlsPosition':
      return { ...state, layout: { ...state.layout, fileControlsPosition: action.position } };
    case 'layout/setWrapLongLines':
      return { ...state, layout: { ...state.layout, wrapLongLines: action.wrap } };
    case 'layout/setFullFileDiff':
      return { ...state, layout: { ...state.layout, fullFileDiff: action.full } };
    case 'file/open': {
      const revealLine =
        action.line != null ? { line: action.line, side: action.side ?? ('RIGHT' as const) } : null;
      return state.pinnedFiles.includes(action.path)
        ? {
            ...state,
            activeFile: action.path,
            mainTab: 'files',
            revealLine,
            openNextFilePending: false,
          }
        : {
            ...state,
            previewFile: action.path,
            activeFile: action.path,
            mainTab: 'files',
            revealLine,
            openNextFilePending: false,
          };
    }
    case 'file/focus':
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
      const pinnedFiles = state.pinnedFiles.filter((p) => p !== action.path);
      const previewFile = state.previewFile === action.path ? null : state.previewFile;
      const activeFile =
        state.activeFile === action.path
          ? (previewFile ?? pinnedFiles.at(-1) ?? null)
          : state.activeFile;
      return { ...state, pinnedFiles, previewFile, activeFile, revealLine: null };
    }
    case 'file/accept':
      return {
        ...state,
        acceptedFiles: [...state.acceptedFiles.filter((p) => p !== action.path), action.path],
      };
    case 'file/revert':
      return { ...state, acceptedFiles: state.acceptedFiles.slice(0, -1) };
    case 'file/openNextWhenReady':
      return { ...state, mainTab: 'files', openNextFilePending: true };
    case 'file/openNextCancel':
      return { ...state, openNextFilePending: false };
    case 'mainTab/set':
      return { ...state, mainTab: action.tab };
    case 'toast/push':
      return { ...state, toasts: [...state.toasts, action.toast] };
    case 'toast/dismiss':
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
      return { ...state, settingsOpen: action.open };
    case 'quickSearch/open':
      if (state.quickSearch === action.mode) return state;
      return { ...state, quickSearch: action.mode };
    case 'quickSearch/close':
      if (state.quickSearch === null) return state;
      return { ...state, quickSearch: null };
    default:
      return state;
  }
}
