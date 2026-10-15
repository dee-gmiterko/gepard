import { mkdtemp, rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import {
  AppError,
  catalogAssetPlatform,
  errorMessage,
  normalizeRepoPath,
  packageDirName,
  parseRepositoryInput,
  pickReleaseAsset,
  releaseTagPrefix,
  repositorySlug,
  type ExtensionInfo,
  type GitHubReleaseSource,
  type RepositoryInput,
} from '@gepard/common';
import type { GhClient } from '../clients/gh';
import { findPackageRoot } from '../helpers/extension';
import { extractTarGz } from '../helpers/tar';
import { readManifest } from '../extensions/scanner';
import type { ExtensionCatalogService } from './extensionCatalog';
import type { ExtensionsService } from './extensions';

export const GitHubRelease = z.looseObject({
  tag_name: z.string(),
  draft: z.boolean().default(false),
  prerelease: z.boolean().default(false),
  assets: z.array(z.looseObject({ name: z.string() })).default([]),
});
export type GitHubRelease = z.infer<typeof GitHubRelease>;

const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export class ExtensionInstallerService {
  constructor(
    private readonly extensions: ExtensionsService,
    private readonly catalog: ExtensionCatalogService,
    private readonly gh: GhClient,
    private readonly target: string,
    private readonly tmpDir: () => string,
  ) {}

  async install(source: GitHubReleaseSource): Promise<ExtensionInfo[]> {
    const repo = parseRepositoryInput(source.repository);
    const dir = normalizeRepoPath(source.path);
    const pinned = this.catalog.find(repo, dir);
    if (pinned && catalogAssetPlatform(pinned, this.target) === null) {
      throw new AppError(
        'EXTENSION_UNSUPPORTED_PLATFORM',
        `"${pinned.name}" has no build for ${this.target}`,
      );
    }
    const expectedName =
      pinned?.name ?? (dir === null ? null : await this.readPackageName(repo, dir));
    const releases = (await this.listReleases(repo)).filter((r) => !r.draft && !r.prerelease);
    const candidates =
      expectedName === null
        ? releases
        : releases.filter((r) => r.tag_name.startsWith(releaseTagPrefix(expectedName)));
    for (const release of candidates) {
      const asset = pickReleaseAsset(
        release.assets.map((a) => a.name),
        this.target,
      );
      if (asset) return this.installRelease(repo, release.tag_name, asset, expectedName);
    }
    throw new AppError(
      'EXTENSION_RELEASE_NOT_FOUND',
      `${repositorySlug(repo)} has no release with an extension archive for ${this.target}`,
    );
  }

  private listReleases(repo: RepositoryInput): Promise<GitHubRelease[]> {
    return this.gh.json(z.array(GitHubRelease), [
      'api',
      `repos/${repositorySlug(repo)}/releases?per_page=100`,
    ]);
  }

  private async readPackageName(repo: RepositoryInput, dir: string): Promise<string> {
    let manifest: { name?: string };
    try {
      const { stdout } = await this.gh.run([
        'api',
        '-H',
        'Accept: application/vnd.github.raw+json',
        `repos/${repositorySlug(repo)}/contents/${dir}/package.json`,
      ]);
      manifest = z.looseObject({ name: z.string().optional() }).parse(JSON.parse(stdout));
    } catch (e) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `${repositorySlug(repo)}/${dir} has no readable package.json (${errorMessage(e)})`,
      );
    }
    if (!manifest.name) {
      throw new AppError(
        'EXTENSION_INVALID_PACKAGE',
        `${repositorySlug(repo)}/${dir}/package.json has no name`,
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
        repositorySlug(repo),
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
      return await this.extensions.install(root, {
        dirName: packageDirName(manifest.name),
        replacePackage: manifest.name,
      });
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }
}
