import { z } from 'zod';
import { IsoDate, Login } from './pr';

export const ProjectId = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[A-Za-z0-9._-]+$/, 'invalid project id')
  .refine((id) => id !== '.' && id !== '..', { message: 'invalid project id' });

export const Project = z.object({
  id: ProjectId,
  url: z.url(),
  owner: z.string(),
  repo: z.string(),
  addedAt: IsoDate,
  cloned: z.boolean(),
});
export type Project = z.infer<typeof Project>;

export const Viewer = z.object({
  login: Login,
  name: z.string().nullable(),
  avatarUrl: z.url(),
  htmlUrl: z.url(),
});
export type Viewer = z.infer<typeof Viewer>;

export const ViewerRepo = z.object({
  owner: z.string(),
  repo: z.string(),
  url: z.url(),
});
export type ViewerRepo = z.infer<typeof ViewerRepo>;

export const PersistedLayout = z.object({
  sidePanelWidth: z.number().min(220).max(640).default(300),
  fileCommentsPanelWidth: z.number().min(220).max(640).default(300),
  fileCommentsPanelOpen: z.boolean().default(false),
  hideViewedFiles: z.boolean().default(false),
  fileControlsPosition: z.object({ x: z.number(), y: z.number() }).nullable().default(null),
});
export type PersistedLayout = z.infer<typeof PersistedLayout>;
