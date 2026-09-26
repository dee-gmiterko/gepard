// UI state, synchronous, no IO (report 04 §5.1). Encodes the spec's
// Behaviors section:
// - each targeting box is set/cleared individually; changing the PR clears
//   the commit (commits are limited to the PR's, spec);
// - setting any target switches the side panel to "targeted";
// - pinned files stay open across target changes (missing view if absent).
// Checkout / index / remote pull on target change are side effects owned by
// the query layer, not this reducer.
export type SidePanelTab = 'files' | 'targeted' | 'search'
export type MainTab = 'files' | 'comments'

/** One entry in the unified toast surface (coordinator spec): every failure
 * in the app — render errors, window/unhandledrejection, failed
 * queries/mutations, background events like a failed clone or index — is
 * reported through errors/report.ts and lands here via state/ToastHost.tsx,
 * the sole place that turns a report into a dispatch. */
export interface Toast {
  id: string
  tone: 'danger' | 'warning'
  message: string
}

export interface Targeting {
  pr: number | null
  commit: string | null
  folder: string | null
}

export interface AppState {
  projectId: string | null
  targeting: Targeting
  sidePanelTab: SidePanelTab
  /** Preserved open even when they don't exist in the current state -> missing view (spec). */
  pinnedFiles: string[]
  /** The one switching tab, replaced by each file picked from navigation (spec:
   * "pinned ones + one switching active file picked from navigation"). */
  previewFile: string | null
  /** The file shown in the viewer: a pinned file or the preview file. */
  activeFile: string | null
  mainTab: MainTab
  /** Result of the last pr.checkout for the current targeting; null until the
   * first checkout completes. Viewers and lists read base/head from here. */
  checkout: { base: string; head: string } | null
  /** The unified toast surface's queue (coordinator spec); survives
   * project open/close (see appReducer below) since it is not project state. */
  toasts: Toast[]
}

export const initialAppState: AppState = {
  projectId: null,
  targeting: { pr: null, commit: null, folder: null },
  sidePanelTab: 'files',
  pinnedFiles: [],
  previewFile: null,
  activeFile: null,
  mainTab: 'files',
  checkout: null,
  toasts: []
}

export type AppAction =
  | { type: 'project/open'; projectId: string }
  | { type: 'project/close' }
  | { type: 'target/pr'; pr: number | null }
  | { type: 'target/commit'; sha: string | null }
  | { type: 'target/folder'; path: string | null }
  | { type: 'target/checkoutResult'; checkout: { base: string; head: string } | null }
  | { type: 'sidePanel/setTab'; tab: SidePanelTab }
  /** Pick a file from navigation (tree, targeted list, search, Up/Down). */
  | { type: 'file/open'; path: string }
  /** Click an existing tab. */
  | { type: 'file/focus'; path: string }
  | { type: 'file/pin'; path: string }
  | { type: 'file/unpin'; path: string }
  | { type: 'mainTab/set'; tab: MainTab }
  | { type: 'toast/push'; toast: Toast }
  | { type: 'toast/dismiss'; id: string }

function withTarget(state: AppState, targeting: Targeting, set: boolean): AppState {
  return { ...state, targeting, sidePanelTab: set ? 'targeted' : state.sidePanelTab }
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'project/open':
      if (state.projectId === action.projectId) return state
      // Toasts are not project state (a failure from the project you're
      // leaving is still a failure you should see) — carried over rather
      // than reset with the rest.
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
    case 'target/folder':
      if (state.targeting.folder === action.path) return state
      return withTarget(state, { ...state.targeting, folder: action.path }, action.path !== null)
    case 'target/checkoutResult':
      return { ...state, checkout: action.checkout }
    case 'sidePanel/setTab':
      return { ...state, sidePanelTab: action.tab }
    case 'file/open':
      return state.pinnedFiles.includes(action.path)
        ? { ...state, activeFile: action.path, mainTab: 'files' }
        : { ...state, previewFile: action.path, activeFile: action.path, mainTab: 'files' }
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
