import { z } from 'zod';
import { ExtensionKind } from '@gepard/common';
import type { Paths } from '../main/paths';
import type { FileLockService } from '../services/fileLock';
import { readJsonFile, writeJsonFile } from '../helpers/jsonFile';

const KnownFile = z.object({
  id: z.string(),
  displayName: z.string(),
  kind: ExtensionKind.optional(),
});
export type KnownFile = z.infer<typeof KnownFile>;

const KnownFilesState = z.record(z.string(), KnownFile);
export type KnownFilesState = z.infer<typeof KnownFilesState>;

export class ExtensionsStore {
  constructor(
    private readonly paths: Paths,
    private readonly locks: FileLockService,
  ) {}

  async getKnownFiles(): Promise<KnownFilesState> {
    return readJsonFile(this.paths.extensionsFilesJsonPath(), KnownFilesState, () => ({}));
  }

  async setKnownFiles(state: KnownFilesState): Promise<void> {
    await writeJsonFile(this.paths.extensionsFilesJsonPath(), state);
  }

  mergeKnownFiles(entries: KnownFilesState): Promise<void> {
    return this.locks.withLock(this.paths.writeLockPath('extensions-files'), async () => {
      await this.setKnownFiles({ ...(await this.getKnownFiles()), ...entries });
    });
  }
}
