import { describe, expect, it } from 'vitest';
import { GhPrOverview, normalizePrOverview } from '../../../helpers/github/prOverview';

const T = (n: number): string => `2026-01-0${n}T00:00:00Z`;

describe('normalizePrOverview', () => {
  it('maps empty decisions to null, drops unsubmitted reviews and names team requests', () => {
    const raw = GhPrOverview.parse({
      state: 'OPEN',
      isDraft: false,
      body: '',
      updatedAt: T(1),
      mergedAt: null,
      closedAt: null,
      reviewDecision: '',
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      statusCheckRollup: [],
      reviews: [
        { author: { login: 'a' }, state: 'APPROVED', submittedAt: T(2) },
        { author: null, state: 'PENDING', submittedAt: null },
      ],
      reviewRequests: [{ login: 'u' }, { name: 'team' }],
    });
    const out = normalizePrOverview(raw);
    expect(out.reviewDecision).toBeNull();
    expect(out.reviews).toHaveLength(1);
    expect(out.reviewRequests).toEqual(['u', 'team']);
    expect(out.mergeReadiness).toEqual({ state: 'READY', blockers: [], warnings: [] });
  });
});
