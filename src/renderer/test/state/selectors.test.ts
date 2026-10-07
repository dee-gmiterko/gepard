import { describe, expect, it } from 'vitest';
import { activeTargetRef } from '../../src/state/selectors';

describe('activeTargetRef', () => {
  it('is null when neither a PR nor a commit is targeted', () => {
    expect(activeTargetRef({ pr: null, commit: null })).toBeNull();
  });

  it('falls back to the PR when the commit is cleared', () => {
    expect(activeTargetRef({ pr: 7, commit: 'abc' })).toEqual({
      kind: 'commit',
      sha: 'abc',
      pr: 7,
    });
    expect(activeTargetRef({ pr: 7, commit: null })).toEqual({ kind: 'pr', pr: 7 });
  });
});
