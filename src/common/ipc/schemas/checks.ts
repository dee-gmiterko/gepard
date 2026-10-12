import { z } from 'zod';

export const AnnotationLevel = z.enum(['failure', 'warning', 'notice']);
export type AnnotationLevel = z.infer<typeof AnnotationLevel>;

export const Annotation = z.object({
  checkName: z.string(),
  level: AnnotationLevel,
  line: z.int().positive(),
  title: z.string(),
  message: z.string(),
  runId: z.int(),
  url: z.string(),
});
export type Annotation = z.infer<typeof Annotation>;

export const CommitAnnotation = z.object({ path: z.string(), annotation: Annotation });
export type CommitAnnotation = z.infer<typeof CommitAnnotation>;
