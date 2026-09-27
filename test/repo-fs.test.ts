import { symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveWithinRepo } from '../src/main/services/repo-fs'
import { makeTmpDir, type TmpDir } from './support/tmp'

describe('resolveWithinRepo', () => {
  let repo: TmpDir
  let outside: TmpDir

  afterEach(async () => {
    await repo?.cleanup()
    await outside?.cleanup()
  })

  it('resolves a plain file inside the repo', async () => {
    repo = await makeTmpDir('repo-fs-plain')
    await writeFile(join(repo.path, 'a.ts'), 'x')
    expect(await resolveWithinRepo(repo.path, 'a.ts')).toBe(join(repo.path, 'a.ts'))
  })

  it('resolves a symlink that points inside the repo', async () => {
    repo = await makeTmpDir('repo-fs-inside-link')
    await writeFile(join(repo.path, 'real.ts'), 'x')
    await symlink(join(repo.path, 'real.ts'), join(repo.path, 'link.ts'))
    expect(await resolveWithinRepo(repo.path, 'link.ts')).toBe(join(repo.path, 'real.ts'))
  })

  it('rejects a committed symlink that escapes the repo', async () => {
    repo = await makeTmpDir('repo-fs-escape-repo')
    outside = await makeTmpDir('repo-fs-escape-outside')
    await writeFile(join(outside.path, 'secret.txt'), 'top secret')
    await symlink(join(outside.path, 'secret.txt'), join(repo.path, 'link.txt'))
    expect(await resolveWithinRepo(repo.path, 'link.txt')).toBeNull()
  })

  it('rejects a path that does not exist', async () => {
    repo = await makeTmpDir('repo-fs-missing')
    expect(await resolveWithinRepo(repo.path, 'nope.ts')).toBeNull()
  })
})
