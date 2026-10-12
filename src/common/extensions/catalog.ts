import { z } from 'zod';
import { AppError } from '../errors';
import { ExtensionKind } from '../ipc/schemas/extensions';

export const PLATFORM_ANY = 'any';

export const CatalogEntry = z.object({
  displayName: z.string().min(1),
  kind: ExtensionKind,
  description: z.string(),
  path: z.string().min(1),
  version: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const ExtensionCatalog = z.object({
  schemaVersion: z.literal(1),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  extensions: z.record(z.string().min(1), CatalogEntry),
});
export type ExtensionCatalog = z.infer<typeof ExtensionCatalog>;

export function platformTarget(platform: string, arch: string): string {
  return `${platform}-${arch}`;
}

export function catalogAssetPlatform(entry: CatalogEntry, target: string): string | null {
  if (entry.platforms.includes(target)) return target;
  if (entry.platforms.includes(PLATFORM_ANY)) return PLATFORM_ANY;
  return null;
}

export function releaseTag(name: string, version: string): string {
  return `${name}-v${version}`;
}

export function releaseArchiveName(name: string, version: string, platform: string): string {
  return `${name}-v${version}-${platform}.tar.gz`;
}

const ARCHIVE_RE = /^(.+)-v([^-]+(?:-[^-]+)*?)-([a-z0-9]+(?:-[a-z0-9]+)?)\.tar\.gz$/;

export function pickReleaseAsset(assetNames: readonly string[], target: string): string | null {
  const archives = assetNames.filter((name) => ARCHIVE_RE.test(name));
  return (
    archives.find((name) => name.endsWith(`-${target}.tar.gz`)) ??
    archives.find((name) => name.endsWith(`-${PLATFORM_ANY}.tar.gz`)) ??
    null
  );
}

function versionParts(version: string): { numbers: number[]; prerelease: string[] } {
  const [core, prerelease = ''] = version.replace(/^v/, '').split('+')[0].split('-', 2);
  const numbers = core.split('.').map((part) => {
    const n = Number.parseInt(part, 10);
    return Number.isNaN(n) ? 0 : n;
  });
  return { numbers, prerelease: prerelease ? prerelease.split('.') : [] };
}

function compareIdentifiers(a: string, b: string): number {
  const an = /^\d+$/.test(a);
  const bn = /^\d+$/.test(b);
  if (an && bn) return Math.sign(Number(a) - Number(b));
  if (an) return -1;
  if (bn) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function compareVersions(a: string, b: string): number {
  const pa = versionParts(a);
  const pb = versionParts(b);
  const length = Math.max(pa.numbers.length, pb.numbers.length);
  for (let i = 0; i < length; i++) {
    const diff = (pa.numbers[i] ?? 0) - (pb.numbers[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0;
  if (pa.prerelease.length === 0) return 1;
  if (pb.prerelease.length === 0) return -1;
  const count = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < count; i++) {
    const ai = pa.prerelease[i];
    const bi = pb.prerelease[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;
    const diff = compareIdentifiers(ai, bi);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  return compareVersions(candidate, installed) > 0;
}

const REPO_NAME_RE = /^[A-Za-z0-9_.-]+$/;

export interface RepositoryInput {
  owner: string;
  repo: string;
}

export function parseRepositoryInput(text: string): RepositoryInput {
  const segments = text
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .split('/');
  if (segments.length !== 2 || !segments.every((s) => REPO_NAME_RE.test(s))) {
    throw new AppError('BAD_INPUT', `expected <owner>/<repo>, got: ${text}`);
  }
  return { owner: segments[0], repo: segments[1] };
}

export function normalizeRepoPath(text: string | null | undefined): string | null {
  const trimmed = (text ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) return null;
  const segments = trimmed.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    throw new AppError('BAD_INPUT', `invalid repository path: ${text}`);
  }
  return segments.join('/');
}
