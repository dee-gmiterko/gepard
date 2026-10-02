import type { PrListItem, ViewerRepo } from '@gepard/common';

const GITHUB_URL_PREFIX_RE = /^https?:\/\/(www\.)?github\.com\//i;

export function repoUrl(repo: ViewerRepo): string {
  return `https://github.com/${repo.owner}/${repo.repo}`;
}

export function repoFilterText(repo: ViewerRepo): string {
  return `${repo.owner}/${repo.repo}`;
}

export function repoSearchQuery(typed: string): string {
  return typed.replace(GITHUB_URL_PREFIX_RE, '').replace(/^\/+/, '');
}

export function prFilterText(pr: PrListItem): string {
  return [
    `#${pr.number}`,
    pr.title,
    pr.author.login,
    pr.headRefName,
    ...pr.labels.map((l) => l.name),
  ].join(' ');
}
