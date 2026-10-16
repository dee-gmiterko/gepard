import { mkdtemp, rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { AppError, repositorySlug, type RepositoryInput } from '@gepard/common';
import type { GhClient } from '../clients/gh';

const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export interface GitHubReleaseDownload {
  kind: 'github-release';
  repo: RepositoryInput;
  tag: string;
  assetName: string;
}

export type DownloadSource = GitHubReleaseDownload;

export class DownloadService {
  constructor(
    private readonly gh: GhClient,
    private readonly tmpDir: string,
  ) {}

  async withDownload<R>(
    source: DownloadSource,
    use: (file: string, workDir: string) => Promise<R>,
  ): Promise<R> {
    const workDir = await mkdtemp(path.join(this.tmpDir, 'gepard-download-'));
    try {
      return await use(await this.fetch(source, workDir), workDir);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private fetch(source: DownloadSource, destDir: string): Promise<string> {
    switch (source.kind) {
      case 'github-release':
        return this.fetchGitHubRelease(source, destDir);
    }
  }

  private async fetchGitHubRelease(
    { repo, tag, assetName }: GitHubReleaseDownload,
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
}
