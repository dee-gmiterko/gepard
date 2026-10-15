import * as path from 'node:path';
import { z } from 'zod';
import {
  AppError,
  catalogAssetPlatform,
  errorMessage,
  GitHubRelease,
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
import { findPackageRoot, readManifest } from '../helpers/extension';
import { extractTarGz } from '../helpers/tar';
import type { ExtensionCatalogService } from './extensionCatalog';
import type { ExtensionsService } from './extensions';
import type { ReleaseDownloadService } from './releaseDownload';

export class ExtensionInstallerService {
  constructor(
    private readonly extensions: ExtensionsService,
    private readonly catalog: ExtensionCatalogService,
    private readonly gh: GhClient,
    private readonly downloads: ReleaseDownloadService,
    private readonly target: string,
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

  private async installRelease(
    repo: RepositoryInput,
    tag: string,
    assetName: string,
    expectedName: string | null,
  ): Promise<ExtensionInfo[]> {
    return this.downloads.withAsset(repo, tag, assetName, async (archive, workDir) => {
      const extractDir = path.join(workDir, 'extract');
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
      return this.extensions.install(root, packageDirName(manifest.name), manifest.name);
    });
  }
}
