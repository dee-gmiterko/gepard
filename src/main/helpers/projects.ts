import type { Project } from '@gepard/common';

export function findProjectByName(projects: Project[], name: string): Project | null {
  const wanted = name.trim().toLowerCase();
  const exact = projects.find(
    (p) => `${p.owner}/${p.repo}`.toLowerCase() === wanted || p.id.toLowerCase() === wanted,
  );
  if (exact) return exact;
  const byRepo = projects.filter((p) => p.repo.toLowerCase() === wanted);
  return byRepo.length === 1 ? byRepo[0] : null;
}
