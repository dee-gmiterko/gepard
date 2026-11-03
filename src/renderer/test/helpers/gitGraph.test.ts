import { describe, expect, it } from 'vitest';
import type { GraphCommit } from '@gepard/common';
import { layoutGraph } from '../../src/helpers/gitGraph';

const commit = (oid: string, parents: string[] = []): GraphCommit => ({
  oid,
  parents,
  messageHeadline: `msg ${oid}`,
  committedDate: '2026-01-01T00:00:00Z',
  authorName: 'Amy',
  refs: [],
});

describe('layoutGraph', () => {
  it('keeps a linear history on one lane', () => {
    const { rows, laneCount } = layoutGraph(
      [commit('c', ['b']), commit('b', ['a']), commit('a')],
      true,
    );
    expect(laneCount).toBe(1);
    expect(rows.map((r) => [r.lane, r.incoming, r.outgoing, r.passing])).toEqual([
      [0, [], [0], []],
      [0, [0], [0], []],
      [0, [0], [], []],
    ]);
  });

  it('forks a second lane for a merge and joins it at the branch point', () => {
    const { rows, laneCount } = layoutGraph(
      [commit('m', ['a', 'b']), commit('a', ['r']), commit('b', ['r']), commit('r')],
      true,
    );
    expect(laneCount).toBe(2);
    expect(rows[0]).toMatchObject({ lane: 0, outgoing: [0, 1] });
    expect(rows[1]).toMatchObject({ lane: 0, incoming: [0], outgoing: [0], passing: [1] });
    expect(rows[2]).toMatchObject({ lane: 1, incoming: [1], outgoing: [0], passing: [0] });
    expect(rows[3]).toMatchObject({ lane: 0, incoming: [0], outgoing: [] });
  });

  it('puts independent branch heads on separate lanes', () => {
    const { rows, laneCount } = layoutGraph(
      [commit('x', ['r']), commit('y', ['r']), commit('r')],
      true,
    );
    expect(laneCount).toBe(2);
    expect(rows[1]).toMatchObject({ lane: 1, passing: [0], outgoing: [0] });
    expect(rows[2]).toMatchObject({ lane: 0, incoming: [0] });
  });

  it('continues a lane toward parents that are not loaded yet', () => {
    const { rows } = layoutGraph([commit('b', ['a'])], false);
    expect(rows[0].outgoing).toEqual([0]);
  });

  it('draws no edges to parents outside a complete list', () => {
    const { rows } = layoutGraph([commit('b', ['a'])], true);
    expect(rows[0].outgoing).toEqual([]);
  });

  it('reuses freed lanes', () => {
    const { laneCount } = layoutGraph(
      [commit('m', ['a', 'b']), commit('b', ['a']), commit('a', ['z']), commit('z')],
      true,
    );
    expect(laneCount).toBe(2);
  });
});
