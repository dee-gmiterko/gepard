import { z } from 'zod';
import { ProjectId } from './project';

export const ProjectRef = z.object({ projectId: ProjectId });
export type ProjectRef = z.infer<typeof ProjectRef>;

export const PrRef = ProjectRef.extend({ pr: z.int().positive() });
export type PrRef = z.infer<typeof PrRef>;

export const CommentsRef = ProjectRef.extend({ pr: z.int().positive().nullable() });
export type CommentsRef = z.infer<typeof CommentsRef>;
