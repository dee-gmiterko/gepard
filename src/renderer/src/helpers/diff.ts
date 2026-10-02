import type { DiffSide } from '@gepard/common';

export function findDiffDocLine(
  infos: readonly { oldLine: number | null; newLine: number | null }[],
  line: number,
  side: DiffSide,
): number | null {
  const key = side === 'LEFT' ? 'oldLine' : 'newLine';
  const i = infos.findIndex((info) => info[key] === line);
  return i === -1 ? null : i + 1;
}
