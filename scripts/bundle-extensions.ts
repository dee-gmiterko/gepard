import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import type { CatalogEntry } from './helpers/catalog';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT_DIR, 'dist/extensions');

const BUNDLED_EXTENSIONS = [
  'extensions/themes/dark',
  'extensions/themes/dark-high-contrast',
  'extensions/themes/light',
  'extensions/themes/light-high-contrast',
  'extensions/locales/en',
];

export interface PublishedRelease {
  tagName: string;
  assets: string[];
}

export interface ReleaseSource {
  publishedReleases: (repository: string) => PublishedRelease[];
  treeSha: (tag: string, dir: string) => string | null;
}

export function findUnreleased(catalog: CatalogEntry[], source: ReleaseSource): string[] {
  const releasesByRepository = new Map<string, PublishedRelease[]>();
  const problems: string[] = [];
  for (const entry of catalog) {
    let releases = releasesByRepository.get(entry.repository);
    if (!releases) {
      releases = source.publishedReleases(entry.repository);
      releasesByRepository.set(entry.repository, releases);
    }
    const platforms = entry.platforms?.length ? entry.platforms : [null];
    const matching = releases
      .filter((release) => release.tagName.startsWith(`${entry.name}-v`))
      .filter((release) => source.treeSha(release.tagName, entry.path) === entry.sha)
      .filter((release) =>
        platforms.every((platform) =>
          release.assets.some((asset) =>
            platform === null ? asset.endsWith('.tgz') : asset.endsWith(`-${platform}.tgz`),
          ),
        ),
      );
    if (matching.length === 0)
      problems.push(`${entry.name} (${entry.path}) has no published release with sha ${entry.sha}`);
  }
  return problems;
}

function gitTreeSha(tag: string, dir: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}:${dir}`], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return null;
  }
}

function ghPublishedReleases(repository: string): PublishedRelease[] {
  const out = execFileSync(
    'gh',
    [
      'release',
      'list',
      '--repo',
      repository,
      '--limit',
      '1000',
      '--exclude-drafts',
      '--exclude-pre-releases',
      '--json',
      'tagName',
    ],
    { encoding: 'utf8' },
  );
  const tags = (JSON.parse(out) as Array<{ tagName: string }>).map((r) => r.tagName);
  return tags.map((tagName) => {
    const view = execFileSync(
      'gh',
      ['release', 'view', tagName, '--repo', repository, '--json', 'assets'],
      { encoding: 'utf8' },
    );
    const { assets } = JSON.parse(view) as { assets: Array<{ name: string }> };
    return { tagName, assets: assets.map((a) => a.name) };
  });
}

function bundle(): void {
  rmSync(OUT_DIR, { recursive: true, force: true });
  for (const dir of BUNDLED_EXTENSIONS) {
    const source = path.join(ROOT_DIR, dir);
    const manifest = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8')) as {
      name: string;
      files?: string[];
    };
    const dest = path.join(OUT_DIR, manifest.name);
    mkdirSync(dest, { recursive: true });
    for (const file of ['package.json', ...(manifest.files ?? [])]) {
      cpSync(path.join(source, file), path.join(dest, file), { recursive: true });
    }
  }
}

function verifyReleased(): void {
  const catalog = JSON.parse(
    readFileSync(path.join(ROOT_DIR, 'extensions/catalog.json'), 'utf8'),
  ) as CatalogEntry[];
  const problems = findUnreleased(catalog, {
    publishedReleases: ghPublishedReleases,
    treeSha: gitTreeSha,
  });
  if (problems.length > 0) {
    console.error(
      'Refusing to release the app: catalog entries not released under their catalogued sha:\n' +
        problems.map((p) => `  - ${p}`).join('\n'),
    );
    process.exitCode = 1;
    return;
  }
  console.log(`All ${catalog.length} catalog entries are released under their catalogued sha.`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  yargs(hideBin(process.argv))
    .command(
      ['bundle', '$0'],
      'Copy the bundled extensions into dist/extensions',
      () => {},
      () => bundle(),
    )
    .command(
      'verify-released',
      'Fail unless every catalog entry is released under its catalogued sha',
      () => {},
      () => verifyReleased(),
    )
    .strict()
    .parseSync();
}
