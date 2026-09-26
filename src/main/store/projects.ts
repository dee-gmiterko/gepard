// The only code that reads or writes project.json (report 04 §4.1):
// `{ url, owner, repo, addedAt }`, id = lowercase "owner__repo". `cloned` is
// derived at read time, never stored: `repo/` only exists once a clone
// completed (services/git.ts clones into a temporary directory and renames
// it at the end).
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { z } from 'zod'
import { Project } from '@shared/ipc/schemas/project'
import { AppError } from '../ipc/registry'
import {
  projectDir,
  projectId as makeProjectId,
  projectJsonPath,
  projectRepoDir,
  projectsDir
} from '../paths'

// project.json on disk = Project minus the derived `cloned` flag.
const ProjectFile = Project.omit({ cloned: true })
type ProjectFile = z.infer<typeof ProjectFile>

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

export async function isCloned(id: string): Promise<boolean> {
  return pathExists(projectRepoDir(id))
}

async function readProjectFile(id: string): Promise<ProjectFile | null> {
  let raw: string
  try {
    raw = await readFile(projectJsonPath(id), 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw e
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch (e) {
    throw new AppError(
      'STORE_CORRUPT',
      `project.json for ${id} is not valid JSON: ${(e as Error).message}`
    )
  }
  const parsed = ProjectFile.safeParse(json)
  if (!parsed.success) {
    throw new AppError(
      'STORE_CORRUPT',
      `project.json for ${id} is invalid: ${z.prettifyError(parsed.error)}`
    )
  }
  return parsed.data
}

/** Write tmp -> rename (report 04 §4.3's atomic-write pattern, applied here
 * too since this is the only code allowed to touch project.json). */
async function writeProjectFile(id: string, data: ProjectFile): Promise<void> {
  const dir = projectDir(id)
  await mkdir(dir, { recursive: true })
  const tmpPath = join(dir, `.project.json.${randomUUID()}.tmp`)
  await writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await rename(tmpPath, projectJsonPath(id))
}

export async function listProjects(): Promise<Project[]> {
  await mkdir(projectsDir(), { recursive: true })
  const entries = await readdir(projectsDir(), { withFileTypes: true })
  const projects: Project[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const file = await readProjectFile(entry.name)
    if (!file) continue
    projects.push({ ...file, cloned: await isCloned(entry.name) })
  }
  projects.sort((a, b) => a.addedAt.localeCompare(b.addedAt))
  return projects
}

export async function getProject(id: string): Promise<Project | null> {
  const file = await readProjectFile(id)
  if (!file) return null
  return { ...file, cloned: await isCloned(id) }
}

// GitHub owner / repository name characters.
const NAME_RE = /^[A-Za-z0-9_.-]+$/

/** Spec: a project is selected "from GitHub url" — only
 * `https://github.com/<owner>/<repo>` (optionally `.git` or a trailing
 * slash) is accepted. */
function parseGitHubRepoUrl(url: string): { owner: string; repo: string } {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new AppError('BAD_INPUT', `not a valid URL: ${url}`)
  }
  const segments = parsed.pathname.split('/').filter(Boolean)
  const owner = segments[0]
  const repo = segments[1]?.replace(/\.git$/, '')
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname !== 'github.com' ||
    segments.length !== 2 ||
    !NAME_RE.test(owner) ||
    !repo ||
    !NAME_RE.test(repo)
  )
    throw new AppError('BAD_INPUT', `expected https://github.com/<owner>/<repo>, got: ${url}`)
  return { owner, repo }
}

/** Registers the project (project.json); cloning is separate (clone.start).
 * Idempotent: adding an already-registered url returns the existing entry. */
export async function addProject(url: string): Promise<Project> {
  const { owner, repo } = parseGitHubRepoUrl(url)
  const id = makeProjectId(owner, repo)
  const existing = await readProjectFile(id)
  if (existing) return { ...existing, cloned: await isCloned(id) }
  const data: ProjectFile = {
    id,
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    addedAt: new Date().toISOString()
  }
  await writeProjectFile(id, data)
  return { ...data, cloned: false }
}

/** Deletes the project directory (clone + review store + project.json). */
export async function removeProject(id: string): Promise<void> {
  await rm(projectDir(id), { recursive: true, force: true })
}
