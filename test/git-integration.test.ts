import { execFile } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { changedFiles, checkoutTarget, cloneProject, listTree } from '../src/main/services/git'
import { nohooksDir, projectRepoDir } from '../src/main/paths'
import { __clearEmittedEvents, __setUserDataDir, emittedEvents } from './support/electron'
import { makeTmpDir, type TmpDir } from './support/tmp'

const execFileP = promisify(execFile)

// Overrides the local/global git config so commits don't depend on the
// machine's identity or gpg-signing settings.
const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.com',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.com',
  GIT_CONFIG_COUNT: '1',
  GIT_CONFIG_KEY_0: 'commit.gpgsign',
  GIT_CONFIG_VALUE_0: 'false'
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileP('git', args, { cwd, env: GIT_ENV })
  return stdout
}

interface Fixture {
  rootSha: string
  baseSha: string
  featureHeadSha: string
}

async function buildFixtureRepo(dir: string): Promise<Fixture> {
  await git(dir, ['init', '-b', 'main'])

  await writeFile(join(dir, 'README.md'), 'hello\n')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'root commit'])
  const rootSha = (await git(dir, ['rev-parse', 'HEAD'])).trim()

  await writeFile(join(dir, 'a.txt'), 'line1\nline2\nline3\n')
  await mkdir(join(dir, 'sub'))
  await writeFile(join(dir, 'sub', 'b.txt'), 'b\n')
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'base commit'])
  const baseSha = (await git(dir, ['rev-parse', 'HEAD'])).trim()

  await git(dir, ['checkout', '-b', 'feature'])
  await writeFile(join(dir, 'a.txt'), 'line1\nCHANGED\nline3\nline4\n')
  await git(dir, ['mv', 'sub/b.txt', 'sub/c.txt'])
  await git(dir, ['rm', 'README.md'])
  await writeFile(
    join(dir, 'image.png'),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 255, 254])
  )
  await git(dir, ['add', '.'])
  await git(dir, ['commit', '-m', 'feature: change files'])
  const featureHeadSha = (await git(dir, ['rev-parse', 'HEAD'])).trim()

  // git sets a clone's origin/HEAD from whichever branch is checked out in
  // the source repo, so HEAD must be back on main before cloning.
  await git(dir, ['checkout', 'main'])

  return { rootSha, baseSha, featureHeadSha }
}

describe('git service (integration)', () => {
  let origin: TmpDir
  let userData: TmpDir

  beforeAll(async () => {
    origin = await makeTmpDir('git-origin')
    userData = await makeTmpDir('git-userdata')
    __setUserDataDir(userData.path)
  })

  afterAll(async () => {
    await origin.cleanup()
    await userData.cleanup()
  })

  it('clones, checks out pr/commit/root-commit targets, and diffs/lists the tree', async () => {
    __clearEmittedEvents()
    const { rootSha, baseSha, featureHeadSha } = await buildFixtureRepo(origin.path)
    const projectId = 'acme__widgets'

    await cloneProject(projectId, `file://${origin.path}`)
    const repoRoot = projectRepoDir(projectId)
    const hooksPath = (await git(repoRoot, ['config', '--get', 'core.hooksPath'])).trim()
    expect(hooksPath).toBe(nohooksDir())

    const progressEvents = emittedEvents.filter((e) => e.channel === 'clone.progress')
    expect(progressEvents.length).toBeGreaterThan(0)
    expect(progressEvents.at(-1)?.payload).toMatchObject({
      projectId,
      phase: 'done',
      percent: 100
    })

    const prResult = await checkoutTarget(projectId, {
      kind: 'pr',
      pr: 1,
      headRefOid: featureHeadSha,
      baseRefOid: baseSha
    })
    expect(prResult).toEqual({ base: baseSha, head: featureHeadSha })

    const commitResult = await checkoutTarget(projectId, { kind: 'commit', sha: baseSha })
    expect(commitResult).toEqual({ base: rootSha, head: baseSha })

    // git's well-known empty tree SHA
    const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
    const rootResult = await checkoutTarget(projectId, { kind: 'commit', sha: rootSha })
    expect(rootResult).toEqual({ base: EMPTY_TREE_SHA, head: rootSha })

    const changes = await changedFiles(projectId, baseSha, featureHeadSha)
    const byPath = new Map(changes.map((c) => [c.path, c]))
    expect(byPath.get('a.txt')).toMatchObject({ changeType: 'MODIFIED', previousPath: null })
    expect(byPath.get('sub/c.txt')).toMatchObject({
      changeType: 'RENAMED',
      previousPath: 'sub/b.txt'
    })
    expect(byPath.get('README.md')).toMatchObject({ changeType: 'DELETED' })
    expect(byPath.get('image.png')).toMatchObject({
      changeType: 'ADDED',
      isBinary: true,
      additions: 0,
      deletions: 0
    })

    const tree = await listTree(projectId, featureHeadSha)
    expect([...tree].sort()).toEqual(['a.txt', 'image.png', 'sub/c.txt'])
  }, 30_000)
})
