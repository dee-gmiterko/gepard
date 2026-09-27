import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { z } from 'zod'
import { Project } from '@shared/ipc/schemas/project'
import { PersistedTargeting } from '@shared/ipc/schemas/pr'
import { AppError } from '../ipc/registry'
import { readJsonFile, writeJsonFile } from './jsonFile'
import {
  projectDir,
  projectId as makeProjectId,
  projectJsonPath,
  projectRepoDir,
  projectsDir
} from '../paths'

const ProjectFile = Project.omit({ cloned: true }).extend({
  lastTargeting: PersistedTargeting.optional()
})
type ProjectFile = z.infer<typeof ProjectFile>

const NO_TARGETING: PersistedTargeting = { pr: null, commit: null, path: null }

function toProject(file: ProjectFile, cloned: boolean): Project {
  const { id, url, owner, repo, addedAt, trustWorkspaceToolchain } = file
  return { id, url, owner, repo, addedAt, cloned, trustWorkspaceToolchain }
}

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
  return readJsonFile(projectJsonPath(id), ProjectFile, () => null)
}

async function writeProjectFile(id: string, data: ProjectFile): Promise<void> {
  await writeJsonFile(projectJsonPath(id), data)
}

export async function listProjects(): Promise<Project[]> {
  await mkdir(projectsDir(), { recursive: true })
  const entries = await readdir(projectsDir(), { withFileTypes: true })
  const projects: Project[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const file = await readProjectFile(entry.name)
    if (!file) continue
    projects.push(toProject(file, await isCloned(entry.name)))
  }
  projects.sort((a, b) => a.addedAt.localeCompare(b.addedAt))
  return projects
}

export async function getProject(id: string): Promise<Project | null> {
  const file = await readProjectFile(id)
  if (!file) return null
  return toProject(file, await isCloned(id))
}

export async function getLastTargeting(id: string): Promise<PersistedTargeting> {
  const file = await readProjectFile(id)
  return file?.lastTargeting ?? NO_TARGETING
}

export async function setLastTargeting(id: string, targeting: PersistedTargeting): Promise<void> {
  const file = await readProjectFile(id)
  if (!file) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${id}`)
  await writeProjectFile(id, { ...file, lastTargeting: targeting })
}

export async function setTrustWorkspaceToolchain(id: string, trust: boolean): Promise<Project> {
  const file = await readProjectFile(id)
  if (!file) throw new AppError('PROJECT_NOT_FOUND', `unknown project: ${id}`)
  await writeProjectFile(id, { ...file, trustWorkspaceToolchain: trust })
  return toProject({ ...file, trustWorkspaceToolchain: trust }, await isCloned(id))
}

const NAME_RE = /^[A-Za-z0-9_.-]+$/

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

export async function addProject(url: string): Promise<Project> {
  const { owner, repo } = parseGitHubRepoUrl(url)
  const id = makeProjectId(owner, repo)
  const existing = await readProjectFile(id)
  if (existing) return toProject(existing, await isCloned(id))
  const data: ProjectFile = {
    id,
    url: `https://github.com/${owner}/${repo}`,
    owner,
    repo,
    addedAt: new Date().toISOString(),
    trustWorkspaceToolchain: false
  }
  await writeProjectFile(id, data)
  return { ...data, cloned: false }
}

export async function removeProject(id: string): Promise<void> {
  await rm(projectDir(id), { recursive: true, force: true })
}
