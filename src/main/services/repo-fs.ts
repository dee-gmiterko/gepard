import { realpath } from 'node:fs/promises'
import * as path from 'node:path'

// A cloned repository can commit symlinks that point outside it.
export async function resolveWithinRepo(repoRoot: string, repoPath: string): Promise<string | null> {
  try {
    const real = await realpath(path.join(repoRoot, repoPath))
    const rel = path.relative(repoRoot, real)
    if (rel.length === 0 || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel))
      return null
    return real
  } catch {
    return null
  }
}
