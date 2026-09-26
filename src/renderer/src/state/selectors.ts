// Derived selections (current file list for Up/Down, folder sums) are
// useMemo over query data + context, not stored (report 04 §5.1). These are
// the pure functions that useMemo hooks in components build on.
import type { AppState, Targeting } from './reducer'
import type { TargetRef } from '@shared/ipc/schemas/pr'

/** "Targeting a PR or a commit enables the diff view for all changed files,
 * otherwise file is shown for it." (spec Behaviors) */
export function isDiffView(state: AppState): boolean {
  return state.targeting.pr !== null || state.targeting.commit !== null
}

/** What is checked out and diffed. A commit wins over the PR: with both set
 * the commit is one of the PR's commits (spec: "setting a PR limits commits
 * to ones from it") and the diff is that commit's. Comments and viewed state
 * still belong to `targeting.pr`. Null: nothing targeted (the default branch
 * head is checked out, no diff). */
export function activeTargetRef({
  pr,
  commit
}: Pick<Targeting, 'pr' | 'commit'>): TargetRef | null {
  if (commit !== null) return { kind: 'commit', sha: commit }
  if (pr !== null) return { kind: 'pr', pr }
  return null
}

/** Tabs in display order: pinned ones, then the preview tab if it is not pinned. */
export function openTabs(state: AppState): string[] {
  return state.previewFile !== null && !state.pinnedFiles.includes(state.previewFile)
    ? [...state.pinnedFiles, state.previewFile]
    : state.pinnedFiles
}
