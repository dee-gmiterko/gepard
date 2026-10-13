import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import {
  AppError,
  catalogAssetPlatform,
  errorMessage,
  normalizeRepoPath,
  parseRepositoryInput,
  pickReleaseAsset,
  releaseArchiveName,
  releaseTag,
  type CatalogEntry,
  type ExtensionCatalog,
  type ExtensionInfo,
  type GitHubReleaseSource,
  type RepositoryInput,
} from '@gepard/common';
import { extractTarGz } from '../helpers/tar';
import { ghClient, type GhClient } from '../clients/gh';
import { extensionCatalog } from './catalog';
import type { ExtensionRegistry } from './registry';
import { readManifest } from './scanner';

export const GitHubRelease = z.looseObject({
  tag_name: z.string(),
  draft: z.boolean().default(false),
  prerelease: z.boolean().default(false),
  assets: z.array(z.looseObject({ name: z.string() })).default([]),
});
export type GitHubRelease = z.infer<typeof GitHubRelease>;

const slug = ({ owner, repo }: RepositoryInput): string => `${owner}/${repo}`;

const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export async function findPackageRoot(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  if (entries.some((e) => e.isFile() && e.name === 'package.json')) return dir;
  const dirs = entries.filter((e) => e.isDirectory());
  if (dirs.length === 1) {
    const nested = path.join(dir, dirs[0].name);
    const inner = await readdir(nested, { withFileTypes: true });
    if (inner.some((e) => e.isFile() && e.name === 'package.json')) return nested;
  }
  throw new AppError('EXTENSION_INVALID_ARCHIVE', 'archive does not contain a package.json');
}

export function findCatalogEntry(
  catalog: ExtensionCatalog,
  repo: RepositoryInput,
  dir: string | null,
): { name: string; entry: CatalogEntry } | null {
  if (dir === null || catalog.repository !== slug(repo)) return null;
  const found = Object.entries(catalog.extensions).find(
    ([, entry]) => normalizeRepoPath(entry.path) === dir,
  );
  return found ? { name: found[0], entry: found[1] } : null;
}

export interface InstallerOptions {
  registry: ExtensionRegistry;
  client?: GhClient;
  catalog?: ExtensionCatalog;
  target?: string;
  tmpDir: () => string;
}

export class ExtensionInstaller {
  private readonly registry: ExtensionRegistry;
  private readonly gh: GhClient;
  private readonly catalog: ExtensionCatalog;
  private readonly target: string;
  private readonly tmpDir: () => string;

  constructor(options: InstallerOptions) {
    this.registry = options.registry;
    this.gh = options.client ?? ghClient;
    this.catalog = options.catalog ?? extensionCatalog;
    this.target = options.target ?? `${process.platform}-${process.arch}`;
    this.tmpDir = options.tmpDir;
  }

  async install(source: GitHubReleaseSource): Promise<ExtensionInfo[]> {
    const repo = parseRepositoryInput(source.repository);
    const dir = normalizeRepoPath(source.path);
    const pinned = findCatalogEntry(this.catalog, repo, dir);
    if (pinned) return this.installPinned(repo, pinned.name, pinned.entry);
    const expectedName = dir === null ? null : await this.readPackageName(repo, dir);
    const releases = (await this.listReleases(repo)).filter((r) => !r.draft && !r.prerelease);
    const candidates =
      expectedName === null
        ? releases
        : releases.filter((r) => r.tag_name.startsWith(`${expectedName}-v`));
    for (const release of candidates) {
      const asset = pickReleaseAsset(
        release.assets.map((a) => a.name),
        this.target,
      );
      if (asset) return this.installRelease(repo, release.tag_name, asset, expectedName);
    }
    throw new AppError(
      'EXTENSION_RELEASE_NOT_FOUND',
      `${slug(repo)} has no release with an extension archive for ${this.target}`,
    );
  }

  private installPinned(
    repo: RepositoryInput,
    name: string,
    entry: CatalogEntry,
  ): Promise<ExtensionInfo[]> {
    const platform = catalogAssetPlatform(entry, this.target);
    if (!platform) {
      throw new AppError(
        'EXTENSION_UNSUPPORTED_PLATFORM',
        `"${name}" has no build for ${this.target}`,
      );
    }
    return this.installRelease(
      repo,
      releaseTag(name, entry.version),
      releaseArchiveName(name, entry.version, platform),
      name,
    );
  }

  private listReleases(repo: RepositoryInput): Promise<GitHubRelease[]> {
    return this.gh.json(z.array(GitHubRelease), [
      'api',
      `repos/${slug(repo)}/releases?per_page=100`,
    ]);
  }

  private async readPackageName(repo: RepositoryInput, dir: string): Promise<string> {
    let manifest: { name?: string };
    try {
      const { stdout } = await this.gh.run([
        'api',
        '-H',
        'Accept: application/vnd.github.raw+json',
        `repos/${slug(repo)}/contents/${dir}/package.json`,
      ]);
      manifest = z.looseObject({ name: z.string().optional() }).parse(JSON.parse(stdout));
    } catch (e) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `${slug(repo)}/${dir} has no readable package.json (${errorMessage(e)})`,
      );
    }
    if (!manifest.name) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `${slug(repo)}/${dir}/package.json has no name`,
      );
    }
    return manifest.name;
  }

  private async downloadAsset(
    repo: RepositoryInput,
    tag: string,
    assetName: string,
    destDir: string,
  ): Promise<string> {
    await this.gh.run(
      [
        'release',
        'download',
        tag,
        '--repo',
        slug(repo),
        '--pattern',
        assetName,
        '--dir',
        destDir,
        '--clobber',
      ],
      { timeoutMs: DOWNLOAD_TIMEOUT_MS },
    );
    const file = path.join(destDir, assetName);
    try {
      await stat(file);
    } catch {
      throw new AppError('EXTENSION_RELEASE_NOT_FOUND', `${tag} has no asset named ${assetName}`);
    }
    return file;
  }

  private async installRelease(
    repo: RepositoryInput,
    tag: string,
    assetName: string,
    expectedName: string | null,
  ): Promise<ExtensionInfo[]> {
    const tmp = await mkdtemp(path.join(this.tmpDir(), 'gepard-ext-'));
    try {
      const archive = await this.downloadAsset(repo, tag, assetName, tmp);
      const extractDir = path.join(tmp, 'extract');
      await extractTarGz(archive, extractDir);
      const root = await findPackageRoot(extractDir);
      const manifest = await readManifest(root).catch((e: unknown) => {
        throw new AppError(
          'EXTENSION_INVALID_PACKAGE',
          `invalid package.json (${errorMessage(e)})`,
        );
      });
      if (!manifest.name || !manifest.version) {
        throw new AppError(
          'EXTENSION_INVALID_PACKAGE',
          'package.json must have a name and a version',
        );
      }
      if (expectedName !== null && manifest.name !== expectedName) {
        throw new AppError(
          'EXTENSION_INVALID_PACKAGE',
          `archive contains "${manifest.name}", expected "${expectedName}"`,
        );
      }
      return await this.registry.install(root, {
        dirName: `${manifest.name}-${manifest.version}`,
        replacePackage: manifest.name,
      });
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }
}
