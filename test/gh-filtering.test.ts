import { describe, expect, it } from 'vitest'
import {
  buildPrListArgs,
  buildPrsFilesQuery,
  filterPrsByPath,
  matchesPrSearch,
  parsePrCreateUrl,
  parsePrsFilesPageInfo,
  parsePrsFilesResponse
} from '../src/main/helpers/ghParsing'
import type { PrListItem } from '../src/shared/ipc/schemas/pr'

const NOT_PAGED = { hasNextPage: false, endCursor: null }

function pr(number: number, overrides: Partial<PrListItem> = {}): PrListItem {
  return {
    number,
    id: `PR_${number}`,
    title: `PR ${number}`,
    author: { login: 'someone' },
    headRefName: `branch-${number}`,
    baseRefName: 'main',
    headRefOid: '0'.repeat(40),
    createdAt: '2026-01-01T00:00:00Z',
    changedFiles: 1,
    labels: [],
    url: `https://github.com/o/r/pull/${number}`,
    ...overrides
  }
}

describe('buildPrsFilesQuery', () => {
  it('gives every candidate PR number its own query variable, in order', () => {
    const { variables } = buildPrsFilesQuery([14390, 14475])
    expect(Object.values(variables)).toEqual([14390, 14475])
  })

  it('produces no variables for an empty candidate list', () => {
    const { variables } = buildPrsFilesQuery([])
    expect(variables).toEqual({})
  })
})

describe('parsePrsFilesResponse', () => {
  it('maps each aliased node back to its PR number and file paths', () => {
    const map = parsePrsFilesResponse({
      pr0: {
        number: 14390,
        files: { pageInfo: NOT_PAGED, nodes: [{ path: 'a.go' }, { path: 'b.go' }] }
      },
      pr1: { number: 14475, files: { pageInfo: NOT_PAGED, nodes: [{ path: 'c.go' }] } }
    })
    expect(map.get(14390)).toEqual(['a.go', 'b.go'])
    expect(map.get(14475)).toEqual(['c.go'])
  })

  it('drops aliases whose PR no longer resolves (null node)', () => {
    const map = parsePrsFilesResponse({ pr0: null })
    expect(map.size).toBe(0)
  })
})

describe('parsePrsFilesPageInfo', () => {
  it('is empty when every PR fit in the first page', () => {
    const map = parsePrsFilesPageInfo({
      pr0: { number: 14390, files: { pageInfo: NOT_PAGED, nodes: [{ path: 'a.go' }] } }
    })
    expect(map.size).toBe(0)
  })

  it('reports a PR whose first page has more, so a PR with >100 changed files is not missed', () => {
    const map = parsePrsFilesPageInfo({
      pr0: {
        number: 14390,
        files: { pageInfo: { hasNextPage: true, endCursor: 'cursor-1' }, nodes: [{ path: 'a.go' }] }
      },
      pr1: { number: 14475, files: { pageInfo: NOT_PAGED, nodes: [{ path: 'b.go' }] } }
    })
    expect(map).toEqual(new Map([[14390, 'cursor-1']]))
  })

  it('ignores a null node', () => {
    expect(parsePrsFilesPageInfo({ pr0: null }).size).toBe(0)
  })

  it('ignores hasNextPage:true with no cursor (defensive: cannot resume without one)', () => {
    const map = parsePrsFilesPageInfo({
      pr0: {
        number: 14390,
        files: { pageInfo: { hasNextPage: true, endCursor: null }, nodes: [] }
      }
    })
    expect(map.size).toBe(0)
  })
})

describe('parsePrCreateUrl', () => {
  it('extracts the PR number from the URL gh pr create prints on success', () => {
    expect(parsePrCreateUrl('https://github.com/cli/cli/pull/14519\n')).toBe(14519)
  })

  it('takes the last line when gh prints other output first', () => {
    const stdout = [
      'Creating pull request for feature into main in cli/cli',
      '',
      'https://github.com/cli/cli/pull/1'
    ].join('\n')
    expect(parsePrCreateUrl(stdout)).toBe(1)
  })

  it('throws when stdout has no PR URL to parse', () => {
    expect(() => parsePrCreateUrl('')).toThrow(/did not return a PR URL/)
  })
})

describe('buildPrListArgs', () => {
  it('asks for open PRs with no arbitrary small cap (a repo can have more than 100 open PRs)', () => {
    const args = buildPrListArgs('cli', 'cli')
    expect(args).toEqual([
      'pr',
      'list',
      '-R',
      'cli/cli',
      '--limit',
      expect.stringMatching(/^\d+$/),
      '--json',
      expect.any(String)
    ])
    const limitIndex = args.indexOf('--limit')
    expect(Number(args[limitIndex + 1])).toBeGreaterThan(100)
  })

  it('adds --search only when a search term is given', () => {
    expect(buildPrListArgs('cli', 'cli')).not.toContain('--search')
    const args = buildPrListArgs('cli', 'cli', 'telemetry in:title')
    expect(args).toContain('--search')
    expect(args).toContain('telemetry in:title')
  })
})

describe('filterPrsByPath', () => {
  it('keeps only PRs with a changed file under the folder', () => {
    const prs = [pr(1), pr(2), pr(3)]
    const filesByNumber = new Map<number, string[]>([
      [1, ['internal/attachments/flags.go']],
      [2, ['docs/readme.md']],
      [3, ['internal/telemetry/x.go']]
    ])
    expect(filterPrsByPath(prs, filesByNumber, 'internal').map((p) => p.number)).toEqual([1, 3])
  })

  it('matches the folder itself as an exact file path, not just as a prefix', () => {
    const prs = [pr(1)]
    const filesByNumber = new Map<number, string[]>([[1, ['internal']]])
    expect(filterPrsByPath(prs, filesByNumber, 'internal')).toHaveLength(1)
  })

  it('does not match a sibling directory with the same prefix', () => {
    const prs = [pr(1)]
    const filesByNumber = new Map<number, string[]>([[1, ['internal-other/x.go']]])
    expect(filterPrsByPath(prs, filesByNumber, 'internal')).toHaveLength(0)
  })

  it('drops a PR with no known files (missing from the files map)', () => {
    const prs = [pr(1)]
    expect(filterPrsByPath(prs, new Map(), 'internal')).toHaveLength(0)
  })

  it('matches a glob target through the shared matcher, same as a plain prefix', () => {
    const prs = [pr(1), pr(2), pr(3)]
    const filesByNumber = new Map<number, string[]>([
      [1, ['internal/flags.go']],
      [2, ['internal/sub/flags.go']],
      [3, ['docs/readme.md']]
    ])
    expect(filterPrsByPath(prs, filesByNumber, 'internal/*.go').map((p) => p.number)).toEqual([1])
  })
})

describe('matchesPrSearch', () => {
  it('matches the PR number as a substring', () => {
    expect(matchesPrSearch(pr(14519), '451')).toBe(true)
    expect(matchesPrSearch(pr(14519), '999')).toBe(false)
  })

  it('matches the title case-insensitively', () => {
    const p = pr(1, { title: 'Document search operator support' })
    expect(matchesPrSearch(p, 'SEARCH operator')).toBe(true)
  })

  it('matches the author login', () => {
    const p = pr(1, { author: { login: 'waldyrious' } })
    expect(matchesPrSearch(p, 'waldy')).toBe(true)
  })

  it('matches the head branch name', () => {
    expect(matchesPrSearch(pr(1, { headRefName: 'fix-telemetry' }), 'telemetry')).toBe(true)
  })

  it('matches a label name', () => {
    const p = pr(1, { labels: [{ name: 'external', color: '000000' }] })
    expect(matchesPrSearch(p, 'exter')).toBe(true)
  })

  it('returns false when nothing in the corpus matches', () => {
    expect(matchesPrSearch(pr(1), 'nope')).toBe(false)
  })
})
