import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
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
  type ExtensionInfo,
  type RepositoryInput,
} from '@gepard/common';
import { extractTarGz } from '../helpers/tar';
import { ghClient } from '../clients/gh';
import { loadCatalog, type FetchText } from './catalog';
import type { ExtensionRegistry } from './registry';
import { readManifest } from './scanner';

export const GitHubRelease = z.looseObject({
  tag_name: z.string(),
  draft: z.boolean().default(false),
  prerelease: z.boolean().default(false),
  assets: z.array(z.looseObject({ name: z.string() })).default([]),
});
export type GitHubRelease = z.infer<typeof GitHubRelease>;

export interface ReleaseSource {
  listReleases(repo: RepositoryInput): Promise<GitHubRelease[]>;
  readRepoFile(repo: RepositoryInput, filePath: string): Promise<string>;
  downloadAsset(
    repo: RepositoryInput,
    tag: string,
    assetName: string,
    destDir: string,
  ): Promise<string>;
}

const slug = ({ owner, repo }: RepositoryInput): string => `${owner}/${repo}`;

const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export const ghReleaseSource: ReleaseSource = {
  listReleases(repo) {
    return ghClient.json(z.array(GitHubRelease), [
      'api',
      `repos/${slug(repo)}/releases?per_page=100`,
    ]);
  },
  async readRepoFile(repo, filePath) {
    const { stdout } = await ghClient.run([
      'api',
      '-H',
      'Accept: application/vnd.github.raw+json',
      `repos/${slug(repo)}/contents/${filePath}`,
    ]);
    return stdout;
  },
  async downloadAsset(repo, tag, assetName, destDir) {
    await ghClient.run(
      ['release', 'download', tag, '--repo', slug(repo), '--pattern', assetName, '--dir', destDir, '--clobber'],
      { timeoutMs: DOWNLOAD_TIMEOUT_MS },
    );
    const file = path.join(destDir, assetName);
    try {
      await stat(file);
    } catch {
      throw new AppError('EXTENSION_RELEASE_NOT_FOUND', `${tag} has no asset named ${assetName}`);
    }
    return file;
  },
};

async function sha256File(file: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(file))
    .digest('hex');
}

export function parseChecksumFile(text: string, fileName: string): string {
  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9a-fA-F]{64})(?:\s+\*?(.+))?$/.exec(line.trim());
    if (!match) continue;
    if (match[2] === undefined || path.posix.basename(match[2].trim()) === fileName) {
      return match[1].toLowerCase();
    }
  }
  throw new AppError('EXTENSION_CHECKSUM_MISMATCH', `no sha256 entry for ${fileName}`);
}

export async function verifyChecksum(archive: string, checksumFile: string): Promise<void> {
  const expected = parseChecksumFile(await readFile(checksumFile, 'utf8'), path.basename(archive));
  const actual = await sha256File(archive);
  if (actual !== expected) {
    throw new AppError(
      'EXTENSION_CHECKSUM_MISMATCH',
      `${path.basename(archive)}: expected sha256 ${expected}, got ${actual}`,
    );
  }
}

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

export interface InstallerOptions {
  registry: ExtensionRegistry;
  source?: ReleaseSource;
  fetchText?: FetchText;
  target?: string;
  tmpDir: () => string;
}

export class ExtensionInstaller {
  private readonly registry: ExtensionRegistry;
  private readonly source: ReleaseSource;
  private readonly fetchText: FetchText | undefined;
  private readonly target: string;
  private readonly tmpDir: () => string;

  constructor(options: InstallerOptions) {
    this.registry = options.registry;
    this.source = options.source ?? ghReleaseSource;
    this.fetchText = options.fetchText;
    this.target = options.target ?? `${process.platform}-${process.arch}`;
    this.tmpDir = options.tmpDir;
  }

  async installFromCatalog(name: string): Promise<ExtensionInfo[]> {
    const { catalog } = await loadCatalog(this.fetchText);
    const entry = catalog.extensions[name];
    if (!entry)
      throw new AppError('EXTENSION_NOT_IN_CATALOG', `"${name}" is not a known extension`);
    const platform = catalogAssetPlatform(entry, this.target);
    if (!platform) {
      throw new AppError(
        'EXTENSION_UNSUPPORTED_PLATFORM',
        `"${name}" has no build for ${this.target}`,
      );
    }
    return this.installRelease(
      parseRepositoryInput(catalog.repository),
      releaseTag(name, entry.version),
      releaseArchiveName(name, entry.version, platform),
      name,
    );
  }

  async installFromRepo(repository: string, repoPath: string | null): Promise<ExtensionInfo[]> {
    const repo = parseRepositoryInput(repository);
    const dir = normalizeRepoPath(repoPath);
    let expectedName: string | null = null;
    if (dir !== null) {
      let manifest: { name?: string };
      try {
        manifest = z
          .looseObject({ name: z.string().optional() })
          .parse(JSON.parse(await this.source.readRepoFile(repo, `${dir}/package.json`)));
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
      expectedName = manifest.name;
    }
    const releases = (await this.source.listReleases(repo)).filter(
      (r) => !r.draft && !r.prerelease,
    );
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

  private async installRelease(
    repo: RepositoryInput,
    tag: string,
    assetName: string,
    expectedName: string | null,
  ): Promise<ExtensionInfo[]> {
    const tmp = await mkdtemp(path.join(this.tmpDir(), 'gepard-ext-'));
    try {
      const archive = await this.source.downloadAsset(repo, tag, assetName, tmp);
      const checksum = await this.source.downloadAsset(repo, tag, `${assetName}.sha256`, tmp);
      await verifyChecksum(archive, checksum);
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
