import { mkdtemp, rm, stat } from 'node:fs/promises';
import * as path from 'node:path';
import { AppError, repositorySlug, type RepositoryInput } from '@gepard/common';
import type { GhClient } from '../clients/gh';

const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export class ReleaseDownloadService {
  constructor(
    private readonly gh: GhClient,
    private readonly tmpDir: () => string,
  ) {}

  async withAsset<R>(
    repo: RepositoryInput,
    tag: string,
    assetName: string,
    use: (archive: string, workDir: string) => Promise<R>,
  ): Promise<R> {
    const workDir = await mkdtemp(path.join(this.tmpDir(), 'gepard-ext-'));
    try {
      return await use(await this.download(repo, tag, assetName, workDir), workDir);
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async download(
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
}
