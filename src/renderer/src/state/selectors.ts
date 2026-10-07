import type { UiState, Targeting } from './reducer';
import type { TargetRef } from '@gepard/common';

export function activeTargetRef({
  pr,
  commit,
}: Pick<Targeting, 'pr' | 'commit'>): TargetRef | null {
  if (commit !== null)
    return pr === null ? { kind: 'commit', sha: commit } : { kind: 'commit', sha: commit, pr };
  if (pr !== null) return { kind: 'pr', pr };
  return null;
}

export function isDiffView(state: Pick<UiState, 'targeting'>): boolean {
  return activeTargetRef(state.targeting) !== null;
}

export function openTabs(pinnedFiles: string[], previewFile: string | null): string[] {
  return previewFile !== null && !pinnedFiles.includes(previewFile)
    ? [...pinnedFiles, previewFile]
    : pinnedFiles;
}
