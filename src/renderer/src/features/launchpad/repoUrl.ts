import { fuzzyFilter } from '../../components/Combobox/fuzzy'
import type { ViewerRepo } from '@shared/ipc/schemas/project'

const GITHUB_URL_PREFIX_RE = /^https?:\/\/(www\.)?github\.com\//i

export function repoUrl(repo: ViewerRepo): string {
  return `https://github.com/${repo.owner}/${repo.repo}`
}

export function repoFilterText(repo: ViewerRepo): string {
  return `${repo.owner}/${repo.repo}`
}

export function repoSearchQuery(typed: string): string {
  return typed.replace(GITHUB_URL_PREFIX_RE, '').replace(/^\/+/, '')
}

export function suggestRepos(repos: readonly ViewerRepo[], typed: string): ViewerRepo[] {
  return fuzzyFilter(repos, repoSearchQuery(typed), repoFilterText)
}
