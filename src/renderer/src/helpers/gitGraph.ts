import type { GraphCommit } from '@gepard/common';

export interface GraphRow {
  commit: GraphCommit;
  lane: number;
  passing: number[];
  incoming: number[];
  outgoing: number[];
}

export interface GraphLayout {
  rows: GraphRow[];
  laneCount: number;
}

// Commits arrive children-first; each lane waits for the oid it expects next. When `complete`, parents outside the list are ignored.
export function layoutGraph(commits: readonly GraphCommit[], complete: boolean): GraphLayout {
  const known = new Set(commits.map((c) => c.oid));
  let active: (string | null)[] = [];
  let laneCount = 1;
  const rows: GraphRow[] = [];

  const freeLane = (): number => {
    const free = active.indexOf(null);
    if (free >= 0) return free;
    active.push(null);
    return active.length - 1;
  };

  for (const commit of commits) {
    const incoming: number[] = [];
    active.forEach((expected, i) => {
      if (expected === commit.oid) incoming.push(i);
    });
    const lane = incoming.length > 0 ? incoming[0] : freeLane();
    const passing: number[] = [];
    active.forEach((expected, i) => {
      if (expected !== null && expected !== commit.oid) passing.push(i);
    });

    for (const i of incoming) active[i] = null;
    const outgoing: number[] = [];
    const parents = complete ? commit.parents.filter((p) => known.has(p)) : commit.parents;
    parents.forEach((parent, index) => {
      const existing = active.indexOf(parent);
      if (existing >= 0) {
        outgoing.push(existing);
        return;
      }
      const target = index === 0 ? lane : freeLane();
      active[target] = parent;
      outgoing.push(target);
    });

    rows.push({ commit, lane, passing, incoming, outgoing });
    laneCount = Math.max(laneCount, active.length, lane + 1);
    while (active.length > 0 && active[active.length - 1] === null) active = active.slice(0, -1);
  }

  return { rows, laneCount };
}
