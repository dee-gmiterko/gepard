import { z } from 'zod';
import { extensionsFilesJsonPath, writeLockPath } from '../paths';
import { withFileLock } from '../helpers/fileLock';
import { readJsonFile, writeJsonFile } from '../helpers/jsonFile';

const KnownFile = z.object({ id: z.string(), displayName: z.string() });
export type KnownFile = z.infer<typeof KnownFile>;

const KnownFilesState = z.record(z.string(), KnownFile);
export type KnownFilesState = z.infer<typeof KnownFilesState>;

export async function getKnownFiles(): Promise<KnownFilesState> {
  return readJsonFile(extensionsFilesJsonPath(), KnownFilesState, () => ({}));
}

export async function setKnownFiles(state: KnownFilesState): Promise<void> {
  await writeJsonFile(extensionsFilesJsonPath(), state);
}

export function mergeKnownFiles(entries: KnownFilesState): Promise<void> {
  return withFileLock(writeLockPath('extensions-files'), async () => {
    await setKnownFiles({ ...(await getKnownFiles()), ...entries });
  });
}
