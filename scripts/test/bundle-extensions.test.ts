import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../helpers/catalog';
import { findUnreleased, type PublishedRelease, type ReleaseSource } from '../bundle-extensions';

const entry = (over: Partial<CatalogEntry> = {}): CatalogEntry => ({
  name: 'gepard-ext-a',
  repository: 'o/r',
  path: 'extensions/lsp/a',
  displayName: 'A',
  kind: 'lsp',
  description: '',
  sha: 'abc',
  ...over,
});

const source = (releases: PublishedRelease[], trees: Record<string, string>): ReleaseSource => ({
  publishedReleases: () => releases,
  archiveSha: (_repository: string, tag: string) => trees[tag] ?? null,
});

describe('findUnreleased', () => {
  it('accepts an entry released under its sha with an archive', () => {
    const releases = [{ tagName: 'gepard-ext-a-v1.0.0', assets: ['a-1.0.0.tgz'] }];
    expect(findUnreleased([entry()], source(releases, { 'gepard-ext-a-v1.0.0': 'abc' }))).toEqual(
      [],
    );
  });

  it('reports an entry whose newest release has a different sha', () => {
    const releases = [{ tagName: 'gepard-ext-a-v1.0.0', assets: ['a.tgz'] }];
    const problems = findUnreleased([entry()], source(releases, { 'gepard-ext-a-v1.0.0': 'old' }));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('gepard-ext-a');
  });

  it('reports an entry with no release at all', () => {
    expect(findUnreleased([entry()], source([], {}))).toHaveLength(1);
  });

  it('ignores releases of other packages sharing a name prefix', () => {
    const releases = [{ tagName: 'gepard-ext-ab-v1.0.0', assets: ['x.tgz'] }];
    expect(
      findUnreleased([entry()], source(releases, { 'gepard-ext-ab-v1.0.0': 'abc' })),
    ).toHaveLength(1);
  });

  it('requires an archive for every supported platform', () => {
    const releases = [{ tagName: 'gepard-ext-a-v1.0.0', assets: ['a-linux-x64.tgz'] }];
    const trees = { 'gepard-ext-a-v1.0.0': 'abc' };
    const e = entry({ platforms: ['linux-x64', 'darwin-arm64'] });
    expect(findUnreleased([e], source(releases, trees))).toHaveLength(1);
    releases[0].assets.push('a-darwin-arm64.tgz');
    expect(findUnreleased([e], source(releases, trees))).toEqual([]);
  });
});
