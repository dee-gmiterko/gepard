import { describe, expect, it } from 'vitest';
import type { ChangedFile } from '@gepard/common';
import { ownersOf, parseCodeowners } from '../src/helpers/codeowners';
import {
  groupByExtension,
  groupByFolder,
  groupByOwner,
  groupTimeline,
  groupTimelineByDay,
  latestReviewStates,
  topChangedFiles,
  type TimelineEvent,
} from '../src/helpers/overview';

function file(path: string, additions: number, deletions = 0): ChangedFile {
  return { path, previousPath: null, changeType: 'MODIFIED', additions, deletions };
}

describe('codeowners', () => {
  const rules = parseCodeowners(`
# comment
* @everyone
*.ts @ts-team   # trailing
/docs/ @docs
src/api/** @api @lead
/README.md
!negated @nobody
`);

  it('lets the last matching rule win', () => {
    expect(ownersOf(rules, 'a.js')).toEqual(['@everyone']);
    expect(ownersOf(rules, 'x/y.ts')).toEqual(['@ts-team']);
    expect(ownersOf(rules, 'src/api/v1/user.ts')).toEqual(['@api', '@lead']);
  });

  it('anchors leading-slash patterns and matches directories', () => {
    expect(ownersOf(rules, 'docs/guide/a.md')).toEqual(['@docs']);
    expect(ownersOf(rules, 'other/docs/a.md')).toEqual(['@everyone']);
  });

  it('treats a rule without owners as unowned and ignores negations', () => {
    expect(ownersOf(rules, 'README.md')).toEqual([]);
    expect(ownersOf(rules, 'negated')).toEqual(['@everyone']);
  });
});

describe('file groups', () => {
  const files = [
    file('src/a/b/c.ts', 5, 1),
    file('src/a/d.ts', 1),
    file('README', 10),
    file('x.TS', 2),
  ];

  it('groups by the first two folders, biggest first', () => {
    expect(groupByFolder(files).map((g) => [g.key, g.files, g.additions])).toEqual([
      ['', 2, 12],
      ['src/a', 2, 6],
    ]);
  });

  it('groups by lowercase extension with an empty key for none', () => {
    expect(groupByExtension(files).map((g) => g.key)).toEqual(['', '.ts']);
    expect(groupByExtension(files)[1].files).toBe(3);
  });

  it('groups unowned files under an empty owner', () => {
    const groups = groupByOwner(files, parseCodeowners('*.ts @t'));
    expect(groups.map((g) => g.key).sort()).toEqual(['', '@t']);
  });

  it('lists the top changed files', () => {
    expect(topChangedFiles(files, 2).map((f) => f.path)).toEqual(['README', 'src/a/b/c.ts']);
  });
});

describe('timeline grouping', () => {
  const ev = (kind: TimelineEvent['kind'], at: string, actor: string): TimelineEvent => ({
    kind,
    at,
    actor,
  });

  it('merges consecutive commits by one actor within an hour only', () => {
    const groups = groupTimeline([
      ev('commit', '2026-01-01T10:00:00Z', 'a'),
      ev('commit', '2026-01-01T10:30:00Z', 'a'),
      ev('commit', '2026-01-01T10:40:00Z', 'b'),
      ev('commit', '2026-01-01T13:00:00Z', 'b'),
      ev('review', '2026-01-01T13:01:00Z', 'b'),
      ev('review', '2026-01-01T13:02:00Z', 'b'),
    ]);
    expect(groups.map((g) => [g.kind, g.events.length])).toEqual([
      ['commit', 2],
      ['commit', 1],
      ['commit', 1],
      ['review', 1],
      ['review', 1],
    ]);
  });

  it('buckets groups by day with per-kind counts', () => {
    const days = groupTimelineByDay(
      groupTimeline([
        ev('commit', '2026-01-01T10:00:00Z', 'a'),
        ev('commit', '2026-01-01T10:10:00Z', 'a'),
        ev('comment', '2026-01-02T10:00:00Z', 'b'),
      ]),
    );
    expect(days.map((d) => [d.day, d.counts.commit, d.counts.comment])).toEqual([
      ['2026-01-01', 2, 0],
      ['2026-01-02', 0, 1],
    ]);
  });
});

describe('latestReviewStates', () => {
  it('keeps the newest state per reviewer and does not let a comment override a verdict', () => {
    const out = latestReviewStates([
      { author: 'a', state: 'CHANGES_REQUESTED', submittedAt: '2026-01-01T00:00:00Z' },
      { author: 'a', state: 'COMMENTED', submittedAt: '2026-01-02T00:00:00Z' },
      { author: 'b', state: 'COMMENTED', submittedAt: '2026-01-01T00:00:00Z' },
      { author: 'b', state: 'APPROVED', submittedAt: '2026-01-03T00:00:00Z' },
      { author: null, state: 'APPROVED', submittedAt: '2026-01-03T00:00:00Z' },
    ]);
    expect(out).toEqual([
      { author: 'a', state: 'CHANGES_REQUESTED' },
      { author: 'b', state: 'APPROVED' },
    ]);
  });
});
