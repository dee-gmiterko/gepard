import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import { AppError } from '../ipc/registry'

export async function readJsonFile<T extends z.ZodType, F = z.output<T>>(
  path: string,
  schema: T,
  fallback: () => F
): Promise<z.output<T> | F> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback()
    throw e
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (e) {
    throw new AppError('STORE_CORRUPT', `${path} is not valid JSON: ${(e as Error).message}`)
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new AppError('STORE_CORRUPT', `${path} is invalid: ${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

// POSIX rename replaces the target file atomically.
export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  const dir = dirname(path)
  await mkdir(dir, { recursive: true })
  const tmpPath = join(dir, `.${basename(path)}.${randomUUID()}.tmp`)
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await rename(tmpPath, path)
}
