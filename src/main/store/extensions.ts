import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import { AppError } from '../ipc/registry'
import { extensionsJsonPath, userDataDir } from '../paths'

const ExtensionsState = z.record(z.string(), z.boolean())
type ExtensionsState = z.infer<typeof ExtensionsState>

async function readState(): Promise<ExtensionsState> {
  let raw: string
  try {
    raw = await readFile(extensionsJsonPath(), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw e
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (e) {
    throw new AppError(
      'STORE_CORRUPT',
      `extensions.json is not valid JSON: ${(e as Error).message}`
    )
  }
  const parsed = ExtensionsState.safeParse(json)
  if (!parsed.success) {
    throw new AppError(
      'STORE_CORRUPT',
      `extensions.json is invalid: ${z.prettifyError(parsed.error)}`
    )
  }
  return parsed.data
}

// Write tmp -> rename: POSIX rename is atomic, so a crash mid-write never
// leaves a corrupt extensions.json.
async function writeState(state: ExtensionsState): Promise<void> {
  const dir = userDataDir()
  await mkdir(dir, { recursive: true })
  const tmpPath = join(dir, `.extensions.json.${randomUUID()}.tmp`)
  await writeFile(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf8')
  await rename(tmpPath, extensionsJsonPath())
}

export async function getEnabledMap(): Promise<ExtensionsState> {
  return readState()
}

export async function isEnabled(id: string, defaultValue = true): Promise<boolean> {
  const state = await readState()
  return state[id] ?? defaultValue
}

export async function setEnabled(id: string, enabled: boolean): Promise<void> {
  const state = await readState()
  state[id] = enabled
  await writeState(state)
}
