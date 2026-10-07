import type { ForkFields } from '../ipc/schemas/pr';

export function prHeadLabel(
  pr: Pick<ForkFields, 'isCrossRepository' | 'headRepositoryOwner'> & { headRefName: string },
): string {
  if (!pr.isCrossRepository) return pr.headRefName;
  const owner = pr.headRepositoryOwner?.login;
  return owner ? `${owner}:${pr.headRefName}` : pr.headRefName;
}
