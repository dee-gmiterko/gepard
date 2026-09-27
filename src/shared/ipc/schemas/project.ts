import { z } from 'zod'
import { IsoDate, Login } from './pr'

export const Project = z.object({
  id: z.string(),
  url: z.url(),
  owner: z.string(),
  repo: z.string(),
  addedAt: IsoDate,
  cloned: z.boolean()
})
export type Project = z.infer<typeof Project>

// Matches the combined shape of `gh auth status` and `gh api user` output.
export const Viewer = z.object({
  login: Login,
  name: z.string().nullable(),
  avatarUrl: z.url(),
  htmlUrl: z.url()
})
export type Viewer = z.infer<typeof Viewer>

export const ViewerRepo = z.object({
  owner: z.string(),
  repo: z.string(),
  url: z.url()
})
export type ViewerRepo = z.infer<typeof ViewerRepo>
