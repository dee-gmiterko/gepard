import { z } from 'zod';
import { extensionsFilesJsonPath } from '../paths';
import { readJsonFile, writeJsonFile } from '../helpers/fs/jsonFile';

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
