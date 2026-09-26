// Small temp-dir helper shared by the tests that need real fixtures on disk
// (git repos, the review store's JSON files). Every caller is responsible
// for awaiting `cleanup()` (typically from `afterAll`/`afterEach`).
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface TmpDir {
  path: string
  cleanup: () => Promise<void>
}

export async function makeTmpDir(prefix: string): Promise<TmpDir> {
  const path = await mkdtemp(join(tmpdir(), `ghlr-${prefix}-`))
  return { path, cleanup: () => rm(path, { recursive: true, force: true }) }
}
