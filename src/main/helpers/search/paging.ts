import { clipPreview } from './preview';

export interface PageMatch {
  line: number;
  preview: string;
  spans: Array<[number, number]>;
}

export interface PageSourceFile {
  path: string;
  matches: PageMatch[];
}

export interface PagedFile {
  path: string;
  matches: PageMatch[];
  moreMatches: boolean;
}

export interface PageOptions {
  offset?: number;
  limit?: number;
  maxMatchesPerFile?: number;
  maxTotalMatches?: number;
}

export interface Page {
  files: PagedFile[];
  hasMore: boolean;
  truncated: boolean;
}

export const EMPTY_PAGE: Page = { files: [], hasMore: false, truncated: false };

export function applyPage(all: readonly PageSourceFile[], opts: PageOptions = {}): Page {
  const offset = opts.offset ?? 0;
  const end = opts.limit === undefined ? all.length : Math.min(all.length, offset + opts.limit);
  const perFile = opts.maxMatchesPerFile ?? Infinity;
  const totalCap = opts.maxTotalMatches ?? Infinity;

  const files: PagedFile[] = [];
  let total = 0;
  let truncated = false;
  for (const file of all.slice(offset, end)) {
    const room = totalCap - total;
    const wanted = Math.min(file.matches.length, perFile);
    const take = Math.min(wanted, room);
    if (take <= 0) {
      truncated = true;
      break;
    }
    const cutByTotal = take < wanted;
    files.push({
      path: file.path,
      matches: file.matches
        .slice(0, take)
        .map((m) => ({ line: m.line, ...clipPreview(m.preview, m.spans) })),
      moreMatches: cutByTotal || file.matches.length > perFile,
    });
    total += take;
    if (cutByTotal) {
      truncated = true;
      break;
    }
  }

  return { files, hasMore: end < all.length, truncated };
}
