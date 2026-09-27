import { describe, expect, it } from 'vitest'
import {
  repoFilterText,
  repoSearchQuery,
  repoUrl,
  suggestRepos
} from '../src/renderer/src/features/launchpad/repoUrl'
import type { ViewerRepo } from '../src/shared/ipc/schemas/project'

const octoWorld: ViewerRepo = {
  owner: 'octocat',
  repo: 'hello-world',
  url: 'https://github.com/octocat/hello-world'
}
const octoSpoon: ViewerRepo = {
  owner: 'octocat',
  repo: 'spoon-knife',
  url: 'https://github.com/octocat/spoon-knife'
}
const orgWidgets: ViewerRepo = {
  owner: 'acme-corp',
  repo: 'widgets',
  url: 'https://github.com/acme-corp/widgets'
}
const repos: ViewerRepo[] = [octoWorld, octoSpoon, orgWidgets]

describe('repoUrl', () => {
  it('builds the https://github.com/<owner>/<repo> URL', () => {
    expect(repoUrl(orgWidgets)).toBe('https://github.com/acme-corp/widgets')
  })
})

describe('repoFilterText', () => {
  it('joins owner and repo for fuzzy matching', () => {
    expect(repoFilterText(orgWidgets)).toBe('acme-corp/widgets')
  })
})

describe('repoSearchQuery', () => {
  it('passes plain typed text through unchanged', () => {
    expect(repoSearchQuery('octo')).toBe('octo')
  })

  it('strips a typed https://github.com/ prefix', () => {
    expect(repoSearchQuery('https://github.com/octocat/hello')).toBe('octocat/hello')
  })

  it('strips the prefix case-insensitively and with a www. host', () => {
    expect(repoSearchQuery('HTTPS://WWW.GITHUB.COM/octocat/')).toBe('octocat/')
  })

  it('leaves a bare host (no protocol) untouched', () => {
    expect(repoSearchQuery('github.com/octocat')).toBe('github.com/octocat')
  })
})

describe('suggestRepos', () => {
  it('returns every repo for an empty query', () => {
    expect(suggestRepos(repos, '')).toHaveLength(3)
  })

  it('fuzzy-matches on the repo name half of owner/repo', () => {
    expect(suggestRepos(repos, 'widgets')).toEqual([orgWidgets])
  })

  it('fuzzy-matches on the owner half of owner/repo', () => {
    expect(suggestRepos(repos, 'acme')).toEqual([orgWidgets])
  })

  it('narrows by a typed https URL, matching owner/repo after the prefix', () => {
    expect(suggestRepos(repos, 'https://github.com/octocat/spoon')).toEqual([octoSpoon])
  })

  it('returns nothing when no repo matches', () => {
    expect(suggestRepos(repos, 'zzz-nope')).toEqual([])
  })

  it('matches every repo under a shared owner when only the owner is typed', () => {
    expect(suggestRepos(repos, 'octocat/')).toEqual([octoWorld, octoSpoon])
  })
})
