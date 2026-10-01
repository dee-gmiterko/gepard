import type { ReportTone } from '../errors/report';

export type SidePanelTab = 'files' | 'targeted' | 'search';
export type MainTab = 'files' | 'comments';

export interface Toast {
  id: string;
  tone: ReportTone;
  message: string;
  detail?: string;
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
  fileControlsPosition: { x: number; y: number } | null;
}

export const defaultLayout: Layout = {
  sidePanelWidth: 300,
  fileCommentsPanelWidth: 300,
  fileCommentsPanelOpen: false,
  hideViewedFiles: false,
  fileControlsPosition: null,
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
  revealLine: { line: number; side: 'LEFT' | 'RIGHT' } | null;
  settingsOpen: boolean;
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
  mainTab: 'files',
  checkout: null,
  toasts: [],
  revealLine: null,
  settingsOpen: false,
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
  | { type: 'layout/setFileControlsPosition'; position: { x: number; y: number } | null }
  | { type: 'file/open'; path: string; line?: number | null; side?: 'LEFT' | 'RIGHT' }
  | { type: 'file/focus'; path: string }
  | { type: 'file/pin'; path: string }
  | { type: 'file/unpin'; path: string }
  | { type: 'file/accept'; path: string }
  | { type: 'file/revert' }
  | { type: 'mainTab/set'; tab: MainTab }
  | { type: 'toast/push'; toast: Toast }
  | { type: 'toast/dismiss'; id: string }
  | { type: 'settings/setOpen'; open: boolean };

function withTarget(state: AppState, targeting: Targeting, set: boolean): AppState {
  const mainTab = targeting.pr === null && state.mainTab === 'comments' ? 'files' : state.mainTab;
  return {
    ...state,
    targeting,
    mainTab,
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
        settingsOpen: state.settingsOpen,
      };
      const { pr, commit, path } = action.targeting;
      return withTarget(opened, action.targeting, pr !== null || commit !== null || path !== null);
    }
    case 'project/close':
      return { ...initialAppState, toasts: state.toasts, settingsOpen: state.settingsOpen };
    case 'target/pr':
      if (state.targeting.pr === action.pr) return state;
      return withTarget(
        state,
        { ...state.targeting, pr: action.pr, commit: null },
        action.pr !== null,
      );
    case 'target/commit':
      if (state.targeting.commit === action.sha) return state;
      return withTarget(state, { ...state.targeting, commit: action.sha }, action.sha !== null);
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
    case 'layout/setFileControlsPosition':
      return { ...state, layout: { ...state.layout, fileControlsPosition: action.position } };
    case 'file/open': {
      const revealLine =
        action.line != null ? { line: action.line, side: action.side ?? ('RIGHT' as const) } : null;
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
    case 'file/accept':
      return {
        ...state,
        acceptedFiles: [...state.acceptedFiles.filter((p) => p !== action.path), action.path],
      };
    case 'file/revert':
      return { ...state, acceptedFiles: state.acceptedFiles.slice(0, -1) };
    case 'mainTab/set':
      return { ...state, mainTab: action.tab };
    case 'toast/push':
      return { ...state, toasts: [...state.toasts, action.toast] };
    case 'toast/dismiss':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    case 'settings/setOpen':
      return { ...state, settingsOpen: action.open };
    default:
      return state;
  }
}
