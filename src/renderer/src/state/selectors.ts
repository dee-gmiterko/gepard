import type { AppState, Targeting } from './reducer'
import type { TargetRef } from '@shared/ipc/schemas/pr'

export function activeTargetRef({
  pr,
  commit
}: Pick<Targeting, 'pr' | 'commit'>): TargetRef | null {
  if (commit !== null) return { kind: 'commit', sha: commit }
  if (pr !== null) return { kind: 'pr', pr }
  return null
}

export function isDiffView(state: AppState): boolean {
  return activeTargetRef(state.targeting) !== null
}

export function openTabs(state: AppState): string[] {
  return state.previewFile !== null && !state.pinnedFiles.includes(state.previewFile)
    ? [...state.pinnedFiles, state.previewFile]
    : state.pinnedFiles
}

export function folderSourcePaths(
  targeting: Pick<Targeting, 'pr' | 'commit'>,
  changedPaths: readonly string[] | undefined,
  treePaths: readonly string[]
): readonly string[] {
  return activeTargetRef(targeting) !== null ? (changedPaths ?? []) : treePaths
}

export function foldersOf(paths: readonly string[]): string[] {
  const set = new Set<string>()
  for (const path of paths) {
    const parts = path.split('/')
    parts.pop()
    let acc = ''
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part
      set.add(acc)
    }
  }
  return [...set].sort()
}
