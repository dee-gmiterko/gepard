import { z } from 'zod'
import { IsoDate, Login } from './pr'

export const ProjectId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._-]+$/, 'invalid project id')
  .refine((id) => id !== '.' && id !== '..', { message: 'invalid project id' })

export const Project = z.object({
  id: ProjectId,
  url: z.url(),
  owner: z.string(),
  repo: z.string(),
  addedAt: IsoDate,
  cloned: z.boolean(),
  trustWorkspaceToolchain: z.boolean().default(false)
})
export type Project = z.infer<typeof Project>

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
