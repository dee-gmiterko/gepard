import { z } from 'zod';
import type { MessageDescriptor } from 'react-intl';
import type { DiffSide } from '@gepard/common';
import type { ReportTone } from '../errors/report';
import { canMarkViewed, viewedAfter, type ReviewFiles } from '../helpers/review';
import {
  acceptFile,
  closeFile,
  openFile,
  sameCheckoutHead,
  stepFile,
  withLayout,
  withTarget,
} from './transitions';

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

export interface UiState {
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
  checkoutHead: { base: string; head: string } | null;
  toasts: Toast[];
  headerStatus: HeaderStatus | null;
  revealLine: { line: number; side: DiffSide } | null;
  settingsOpen: boolean;
  quickSearch: QuickSearchMode | null;
}

export const initialUiState: UiState = {
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
  checkoutHead: null,
  toasts: [],
  headerStatus: null,
  revealLine: null,
  settingsOpen: false,
  quickSearch: null,
};

export type UiAction =
  | { type: 'project/open'; projectId: string; targeting: Targeting; layout: Layout }
  | { type: 'project/close' }
  | { type: 'target/pr'; pr: number | null }
  | { type: 'target/commit'; sha: string | null }
  | { type: 'target/path'; path: string | null }
  | {
      type: 'target/checkoutHeadResult';
      checkoutHead: { base: string; head: string } | null;
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
  | { type: 'viewed/mark'; paths: string[]; viewed: boolean; review: ReviewFiles }
  | { type: 'file/step'; direction: 1 | -1; review: ReviewFiles }
  | { type: 'review/acceptNext'; review: ReviewFiles }
  | { type: 'review/revertPrev' };

export function uiReducer(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case 'project/open': {
      if (state.projectId === action.projectId) return state;
      const opened = {
        ...initialUiState,
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
        ...initialUiState,
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
        checkoutHead: null,
      };
    case 'target/commit':
      if (state.targeting.commit === action.sha) return state;
      return {
        ...withTarget(state, { ...state.targeting, commit: action.sha }, action.sha !== null),
        checkoutHead: null,
      };
    case 'target/path':
      if (state.targeting.path === action.path) return state;
      return withTarget(state, { ...state.targeting, path: action.path }, action.path !== null);
    case 'target/checkoutHeadResult':
      if (
        action.for &&
        (action.for.pr !== state.targeting.pr || action.for.commit !== state.targeting.commit)
      ) {
        return state;
      }
      if (sameCheckoutHead(state.checkoutHead, action.checkoutHead)) return state;
      return { ...state, checkoutHead: action.checkoutHead };
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
    case 'file/open':
      return openFile(state, action.path, action.line, action.side);
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
    case 'file/close':
      return closeFile(state, action.path);
    case 'file/accept':
      return acceptFile(state, action.path);
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
      return openFile(state, action.path);
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
    case 'viewed/mark': {
      if (state.targeting.pr === null) return state;
      const { activeFile, layout } = state;
      if (
        action.viewed &&
        layout.hideViewedFiles &&
        activeFile !== null &&
        action.paths.includes(activeFile)
      ) {
        const skip = viewedAfter(action.review, action.paths, true);
        return stepFile(state, action.review.targeted, skip, 1);
      }
      return state;
    }
    case 'file/step':
      return stepFile(
        state,
        action.review.targeted,
        new Set(action.review.viewed),
        action.direction,
      );
    case 'review/acceptNext': {
      const path = state.activeFile;
      if (path === null) return state;
      const markable = canMarkViewed(state.targeting.pr, action.review, path);
      const accepted = markable ? acceptFile(state, path) : state;
      const skip = markable
        ? viewedAfter(action.review, [path], true)
        : new Set(action.review.viewed);
      const moved = stepFile(accepted, action.review.targeted, skip, 1);
      return moved === accepted ? closeFile(accepted, path) : moved;
    }
    case 'review/revertPrev': {
      const path = state.acceptedFiles.at(-1);
      if (path === undefined) return state;
      return openFile({ ...state, acceptedFiles: state.acceptedFiles.slice(0, -1) }, path);
    }
    default:
      return state;
  }
}
