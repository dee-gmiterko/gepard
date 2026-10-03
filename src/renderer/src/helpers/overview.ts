import type {
  ChangedFile,
  Commit,
  PrOverviewDetails,
  ReviewState,
  ReviewThread,
} from '@gepard/common';
import { ownersOf, type CodeownersRule } from './codeowners';

export interface FileGroup {
  key: string;
  files: number;
  additions: number;
  deletions: number;
}

const FOLDER_DEPTH = 2;
export const NO_EXTENSION = '';
export const UNOWNED = '';

function groupBy(
  files: readonly ChangedFile[],
  keysOf: (file: ChangedFile) => string[],
): FileGroup[] {
  const groups = new Map<string, FileGroup>();
  for (const file of files) {
    for (const key of keysOf(file)) {
      const group = groups.get(key) ?? { key, files: 0, additions: 0, deletions: 0 };
      group.files += 1;
      group.additions += file.additions;
      group.deletions += file.deletions;
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.additions + b.deletions - (a.additions + a.deletions) || a.key.localeCompare(b.key),
  );
}

export function groupByFolder(files: readonly ChangedFile[]): FileGroup[] {
  return groupBy(files, (f) => [f.path.split('/').slice(0, -1).slice(0, FOLDER_DEPTH).join('/')]);
}

export function groupByExtension(files: readonly ChangedFile[]): FileGroup[] {
  return groupBy(files, (f) => {
    const name = f.path.slice(f.path.lastIndexOf('/') + 1);
    const dot = name.lastIndexOf('.');
    return [dot > 0 ? name.slice(dot).toLowerCase() : NO_EXTENSION];
  });
}

export function groupByOwner(
  files: readonly ChangedFile[],
  rules: readonly CodeownersRule[],
): FileGroup[] {
  return groupBy(files, (f) => {
    const owners = ownersOf(rules, f.path);
    return owners.length > 0 ? owners : [UNOWNED];
  });
}

export function topChangedFiles(files: readonly ChangedFile[], limit: number): ChangedFile[] {
  return [...files]
    .sort(
      (a, b) =>
        b.additions + b.deletions - (a.additions + a.deletions) || a.path.localeCompare(b.path),
    )
    .slice(0, limit);
}

export type TimelineKind = 'opened' | 'commit' | 'comment' | 'review' | 'merged' | 'closed';

export interface TimelineEvent {
  kind: TimelineKind;
  at: string;
  actor: string | null;
  reviewState?: ReviewState;
  sha?: string;
}

export interface TimelineGroup {
  kind: TimelineKind;
  actor: string | null;
  at: string;
  events: TimelineEvent[];
}

export interface TimelineDay {
  day: string;
  groups: TimelineGroup[];
  counts: Record<TimelineKind, number>;
}

const GROUP_WINDOW_MS = 60 * 60 * 1000;
const MERGEABLE: ReadonlySet<TimelineKind> = new Set(['commit', 'comment']);

export function buildTimelineEvents(input: {
  author: string | null;
  createdAt: string;
  commits: readonly Commit[];
  threads: readonly ReviewThread[];
  details: PrOverviewDetails | null;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [{ kind: 'opened', at: input.createdAt, actor: input.author }];
  for (const c of input.commits) {
    events.push({
      kind: 'commit',
      at: c.committedDate,
      actor: c.authors[0]?.login ?? c.authors[0]?.name ?? null,
      sha: c.oid,
    });
  }
  for (const t of input.threads) {
    for (const c of t.comments) {
      if (c.local?.status === 'deleted') continue;
      events.push({ kind: 'comment', at: c.createdAt, actor: c.author?.login ?? null });
    }
  }
  const { details } = input;
  if (details) {
    for (const r of details.reviews) {
      if (r.state === 'COMMENTED' || r.state === 'PENDING') continue;
      events.push({ kind: 'review', at: r.submittedAt, actor: r.author, reviewState: r.state });
    }
    if (details.mergedAt) events.push({ kind: 'merged', at: details.mergedAt, actor: null });
    else if (details.closedAt) events.push({ kind: 'closed', at: details.closedAt, actor: null });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

export function groupTimeline(events: readonly TimelineEvent[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  for (const event of events) {
    const last = groups.at(-1);
    const lastEvent = last?.events.at(-1);
    if (
      last &&
      lastEvent &&
      MERGEABLE.has(event.kind) &&
      last.kind === event.kind &&
      last.actor === event.actor &&
      Date.parse(event.at) - Date.parse(lastEvent.at) <= GROUP_WINDOW_MS
    ) {
      last.events.push(event);
    } else {
      groups.push({ kind: event.kind, actor: event.actor, at: event.at, events: [event] });
    }
  }
  return groups;
}

export function groupTimelineByDay(groups: readonly TimelineGroup[]): TimelineDay[] {
  const days: TimelineDay[] = [];
  for (const group of groups) {
    const day = group.at.slice(0, 10);
    let entry = days.at(-1);
    if (entry?.day !== day) {
      entry = {
        day,
        groups: [],
        counts: { opened: 0, commit: 0, comment: 0, review: 0, merged: 0, closed: 0 },
      };
      days.push(entry);
    }
    entry.groups.push(group);
    entry.counts[group.kind] += group.events.length;
  }
  return days;
}

export function latestReviewStates(
  reviews: PrOverviewDetails['reviews'],
): { author: string; state: ReviewState }[] {
  const latest = new Map<string, { state: ReviewState; at: string }>();
  for (const r of reviews) {
    if (!r.author || r.state === 'PENDING') continue;
    const prev = latest.get(r.author);
    if (r.state === 'COMMENTED' && prev && prev.state !== 'COMMENTED') continue;
    if (!prev || r.submittedAt >= prev.at)
      latest.set(r.author, { state: r.state, at: r.submittedAt });
  }
  return [...latest].map(([author, { state }]) => ({ author, state }));
}
