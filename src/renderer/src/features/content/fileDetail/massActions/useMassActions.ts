import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { invoke } from '../../../../ipc/client';
import { qk } from '../../../../queries/keys';
import { useCheckoutHead, useProjectId } from '../../../../state/hooks';
import { useChangedFiles, useFileDiff } from '../../../../queries/files';
import {
  changeLines,
  changeSignature,
  changedRows,
  matchesSimilar,
  similarMatcher,
} from '../../../../helpers/diff';
import type { LineSymbol } from '@gepard/common';

const MAX_SYMBOL_LINES = 60;

export interface MassActions {
  sameSet?: string[];
  similarSet?: string[];
  deletedSet?: string[];
  removedSet?: string[];
}

export function useMassActions(path: string | null): MassActions {
  const checkoutHead = useCheckoutHead();
  const projectId = useProjectId() ?? '';
  const base = checkoutHead?.base ?? '';
  const head = checkoutHead?.head ?? '';
  const diff = useFileDiff(path ?? '');
  const changed = useChangedFiles();

  const rows = useMemo(
    () => (diff.data?.kind === 'text' ? changedRows(diff.data.rows) : []),
    [diff.data],
  );
  const lines = useMemo(() => changeLines(rows), [rows]);

  const candidatePaths = useMemo(() => {
    const self = path === null ? undefined : changed.data?.find((f) => f.path === path);
    if (!self || lines.length === 0) return [];
    return (changed.data ?? [])
      .filter(
        (f) => f.path !== path && f.additions === self.additions && f.deletions === self.deletions,
      )
      .map((f) => f.path);
  }, [changed.data, path, lines.length]);

  const candidateLines = useQueries({
    queries: candidatePaths.map((p) => ({
      queryKey: qk.fileDiff(projectId, base, head, p),
      queryFn: () => invoke('files.diff', { projectId, base, head, path: p }),
      staleTime: Infinity,
    })),
    combine: (results) =>
      results.map((r) => (r.data?.kind === 'text' ? changeLines(r.data.rows) : null)),
  });

  const symbolLines = lines.length <= MAX_SYMBOL_LINES ? rows : [];
  const symbolsPerLine = useQueries({
    queries: symbolLines.map((r) => ({
      queryKey: [...qk.file(projectId, head, path ?? ''), 'lineSymbols', r.newLine] as const,
      queryFn: () =>
        invoke('symbols.line', { projectId, sha: head, path: path ?? '', line: r.newLine ?? 1 }),
      enabled: r.kind === 'add' && r.newLine !== null && Boolean(projectId) && Boolean(head),
      staleTime: Infinity,
    })),
    combine: (results) => ({
      ready: results.every((r) => !r.isPending || r.fetchStatus === 'idle'),
      symbols: results.map((r): LineSymbol[] => r.data?.symbols ?? []),
    }),
  });

  return useMemo(() => {
    if (path === null)
      return {
        sameSet: undefined,
        similarSet: undefined,
        deletedSet: undefined,
        removedSet: undefined,
      };
    const signature = changeSignature(lines);
    const same: string[] = [];
    const rest: { path: string; lines: string[] }[] = [];
    candidatePaths.forEach((p, i) => {
      const other = candidateLines[i];
      if (!other) return;
      if (changeSignature(other) === signature) same.push(p);
      else rest.push({ path: p, lines: other });
    });
    const matcher =
      symbolsPerLine.ready && symbolLines.length === lines.length
        ? similarMatcher(lines, symbolsPerLine.symbols)
        : null;
    const similar = matcher
      ? rest.filter((c) => matchesSimilar(matcher, c.lines)).map((c) => c.path)
      : [];
    const files = changed.data ?? [];
    const isDeleted = files.some((f) => f.path === path && f.changeType === 'DELETED');
    const otherDeleted = isDeleted
      ? files.filter((f) => f.path !== path && f.changeType === 'DELETED').map((f) => f.path)
      : [];
    const isRemoval = (f: { additions: number; deletions: number }): boolean =>
      f.additions === 0 && f.deletions > 0;
    const selfFile = files.find((f) => f.path === path);
    const otherRemoved =
      selfFile && isRemoval(selfFile)
        ? files.filter((f) => f.path !== path && isRemoval(f)).map((f) => f.path)
        : [];
    return {
      removedSet: otherRemoved.length > 0 ? [path, ...otherRemoved] : undefined,
      deletedSet: otherDeleted.length > 0 ? [path, ...otherDeleted] : undefined,
      sameSet: same.length > 0 ? [path, ...same] : undefined,
      similarSet: similar.length > 0 ? [path, ...similar] : undefined,
    };
  }, [
    path,
    changed.data,
    lines,
    candidatePaths,
    candidateLines,
    symbolsPerLine,
    symbolLines.length,
  ]);
}
