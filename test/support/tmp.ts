import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface TmpDir {
  path: string
  cleanup: () => Promise<void>
}

export async function makeTmpDir(prefix: string): Promise<TmpDir> {
  const path = await mkdtemp(join(tmpdir(), `gepard-${prefix}-`))
  return { path, cleanup: () => rm(path, { recursive: true, force: true }) }
}
