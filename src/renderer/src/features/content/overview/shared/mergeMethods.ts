import { defineMessages } from 'react-intl';
import { MergeMethod, type AllowedMergeMethods } from '@gepard/common';

export const methodMessages = defineMessages({
  merge: { id: 'content.overview.merge.method.merge', defaultMessage: 'Create a merge commit' },
  squash: { id: 'content.overview.merge.method.squash', defaultMessage: 'Squash and merge' },
  rebase: { id: 'content.overview.merge.method.rebase', defaultMessage: 'Rebase and merge' },
});

export const METHOD_LABELS = {
  MERGE: methodMessages.merge,
  SQUASH: methodMessages.squash,
  REBASE: methodMessages.rebase,
} as const satisfies Record<MergeMethod, unknown>;

const METHODS = MergeMethod.options;
const ALLOWED_KEYS = {
  MERGE: 'merge',
  SQUASH: 'squash',
  REBASE: 'rebase',
} as const satisfies Record<MergeMethod, keyof AllowedMergeMethods>;
const DEFAULT_ORDER: readonly MergeMethod[] = ['MERGE', 'SQUASH', 'REBASE'];

export function offeredMethods(allowed: AllowedMergeMethods | undefined): readonly MergeMethod[] {
  if (!allowed) return METHODS;
  const offered = METHODS.filter((m) => allowed[ALLOWED_KEYS[m]]);
  return offered.length > 0 ? offered : METHODS;
}

export function resolveMethod(
  chosen: MergeMethod | null,
  offered: readonly MergeMethod[],
): MergeMethod {
  if (chosen && offered.includes(chosen)) return chosen;
  return DEFAULT_ORDER.find((m) => offered.includes(m)) ?? 'MERGE';
}

export function toMergeMethod(value: string): MergeMethod {
  return METHODS.find((m) => m === value) ?? 'MERGE';
}
