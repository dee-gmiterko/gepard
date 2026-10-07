export interface PrHeadInfo {
  headRefName: string;
  isCrossRepository: boolean;
  headRepositoryOwner: { login: string } | null;
}

export function prHeadLabel(pr: PrHeadInfo): string {
  if (!pr.isCrossRepository) return pr.headRefName;
  const owner = pr.headRepositoryOwner?.login;
  return owner ? `${owner}:${pr.headRefName}` : pr.headRefName;
}
