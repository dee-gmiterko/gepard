import { z } from 'zod'
import { extensionsFilesJsonPath, extensionsJsonPath } from '../paths'
import { readJsonFile, writeJsonFile } from './jsonFile'

const ExtensionsState = z.record(z.string(), z.boolean())
export type ExtensionsState = z.infer<typeof ExtensionsState>

async function readState(): Promise<ExtensionsState> {
  return readJsonFile(extensionsJsonPath(), ExtensionsState, () => ({}))
}

export async function getEnabledMap(): Promise<ExtensionsState> {
  return readState()
}

export async function setEnabled(id: string, enabled: boolean): Promise<void> {
  const state = await readState()
  state[id] = enabled
  await writeJsonFile(extensionsJsonPath(), state)
}

const KnownFile = z.object({ id: z.string(), displayName: z.string() })
export type KnownFile = z.infer<typeof KnownFile>

const KnownFilesState = z.record(z.string(), KnownFile)
export type KnownFilesState = z.infer<typeof KnownFilesState>

export async function getKnownFiles(): Promise<KnownFilesState> {
  return readJsonFile(extensionsFilesJsonPath(), KnownFilesState, () => ({}))
}

export async function setKnownFiles(state: KnownFilesState): Promise<void> {
  await writeJsonFile(extensionsFilesJsonPath(), state)
}
