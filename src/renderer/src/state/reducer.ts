import type { ReportTone } from '../errors/report'

export type SidePanelTab = 'files' | 'targeted' | 'search'
export type MainTab = 'files' | 'comments'

export interface Toast {
  id: string
  tone: ReportTone
  message: string
}

export interface Targeting {
  pr: number | null
  commit: string | null
  path: string | null
}

export interface AppState {
  projectId: string | null
  targeting: Targeting
  sidePanelTab: SidePanelTab
  pinnedFiles: string[]
  previewFile: string | null
  activeFile: string | null
  mainTab: MainTab
  checkout: { base: string; head: string } | null
  toasts: Toast[]
  revealLine: { line: number; side: 'LEFT' | 'RIGHT' } | null
}

export const initialAppState: AppState = {
  projectId: null,
  targeting: { pr: null, commit: null, path: null },
  sidePanelTab: 'files',
  pinnedFiles: [],
  previewFile: null,
  activeFile: null,
  mainTab: 'files',
  checkout: null,
  toasts: [],
  revealLine: null
}

export type AppAction =
  | { type: 'project/open'; projectId: string }
  | { type: 'project/close' }
  | { type: 'target/pr'; pr: number | null }
  | { type: 'target/commit'; sha: string | null }
  | { type: 'target/path'; path: string | null }
  | { type: 'target/restore'; targeting: Targeting }
  | { type: 'target/checkoutResult'; checkout: { base: string; head: string } | null }
  | { type: 'sidePanel/setTab'; tab: SidePanelTab }
  | { type: 'file/open'; path: string; line?: number | null; side?: 'LEFT' | 'RIGHT' }
  | { type: 'file/focus'; path: string }
  | { type: 'file/pin'; path: string }
  | { type: 'file/unpin'; path: string }
  | { type: 'mainTab/set'; tab: MainTab }
  | { type: 'toast/push'; toast: Toast }
  | { type: 'toast/dismiss'; id: string }

function withTarget(state: AppState, targeting: Targeting, set: boolean): AppState {
  const mainTab = targeting.pr === null && state.mainTab === 'comments' ? 'files' : state.mainTab
  return { ...state, targeting, mainTab, sidePanelTab: set ? 'targeted' : state.sidePanelTab }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'project/open':
      if (state.projectId === action.projectId) return state
      return { ...initialAppState, projectId: action.projectId, toasts: state.toasts }
    case 'project/close':
      return { ...initialAppState, toasts: state.toasts }
    case 'target/pr':
      if (state.targeting.pr === action.pr) return state
      return withTarget(
        state,
        { ...state.targeting, pr: action.pr, commit: null },
        action.pr !== null
      )
    case 'target/commit':
      if (state.targeting.commit === action.sha) return state
      return withTarget(state, { ...state.targeting, commit: action.sha }, action.sha !== null)
    case 'target/path':
      if (state.targeting.path === action.path) return state
      return withTarget(state, { ...state.targeting, path: action.path }, action.path !== null)
    case 'target/restore': {
      const { pr, commit, path } = action.targeting
      return withTarget(state, action.targeting, pr !== null || commit !== null || path !== null)
    }
    case 'target/checkoutResult':
      return { ...state, checkout: action.checkout }
    case 'sidePanel/setTab':
      return { ...state, sidePanelTab: action.tab }
    case 'file/open': {
      const revealLine =
        action.line != null ? { line: action.line, side: action.side ?? ('RIGHT' as const) } : null
      return state.pinnedFiles.includes(action.path)
        ? { ...state, activeFile: action.path, mainTab: 'files', revealLine }
        : {
            ...state,
            previewFile: action.path,
            activeFile: action.path,
            mainTab: 'files',
            revealLine
          }
    }
    case 'file/focus':
      return { ...state, activeFile: action.path, mainTab: 'files' }
    case 'file/pin':
      if (state.pinnedFiles.includes(action.path)) return state
      return {
        ...state,
        pinnedFiles: [...state.pinnedFiles, action.path],
        previewFile: state.previewFile === action.path ? null : state.previewFile
      }
    case 'file/unpin': {
      if (!state.pinnedFiles.includes(action.path)) return state
      const pinnedFiles = state.pinnedFiles.filter((p) => p !== action.path)
      const activeFile =
        state.activeFile === action.path
          ? (state.previewFile ?? pinnedFiles.at(-1) ?? null)
          : state.activeFile
      return { ...state, pinnedFiles, activeFile }
    }
    case 'mainTab/set':
      return { ...state, mainTab: action.tab }
    case 'toast/push':
      return { ...state, toasts: [...state.toasts, action.toast] }
    case 'toast/dismiss':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }
    default:
      return state
  }
}
