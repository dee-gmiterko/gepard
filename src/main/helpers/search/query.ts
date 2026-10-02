import type { ChannelParsedInput, GroupedResult } from '@gepard/common';
import type { Page, PageOptions } from './paging';

const UNPAGED_MAX_MATCHES = 500;
const DEFAULT_MAX_MATCHES_PER_FILE = 50;

type ParsedSearch = ChannelParsedInput<'search.run'>;

export function searchRunKey(input: ParsedSearch): string {
  const base = `search.run:${input.projectId}:${input.kind}`;
  switch (input.kind) {
    case 'pattern':
      return input.word ? `${base}:word:${input.scope}:${input.text}` : base;
    case 'exactLine':
      return `${base}:${input.origin.path}:${input.origin.line}`;
    case 'references':
      return `${base}:${input.at.path}:${input.at.pos.line}:${input.at.pos.col}`;
    case 'regex':
      return base;
  }
}

export function pageOptions(input: ParsedSearch): PageOptions {
  const paged = input.limit !== undefined;
  return {
    offset: input.offset,
    limit: input.limit,
    maxMatchesPerFile:
      input.maxMatchesPerFile ?? (paged ? DEFAULT_MAX_MATCHES_PER_FILE : undefined),
    maxTotalMatches: paged ? undefined : UNPAGED_MAX_MATCHES,
  };
}

export function toResult(input: ParsedSearch, page: Page): GroupedResult {
  return {
    query: { kind: input.kind, text: input.text, scope: input.scope },
    files: page.files,
    offset: input.offset,
    nextOffset: page.hasMore ? input.offset + page.files.length : null,
    hasMore: page.hasMore,
    truncated: page.truncated,
    matchesInPage: page.files.reduce((n, f) => n + f.matches.length, 0),
  };
}
