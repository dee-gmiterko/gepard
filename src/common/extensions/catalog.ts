import { z } from 'zod';
import { ExtensionKind } from '../ipc/schemas/extensions';

export const CatalogEntry = z.object({
  name: z.string().min(1),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  path: z.string().min(1),
  displayName: z.string().min(1),
  kind: ExtensionKind,
  description: z.string(),
  platforms: z.array(z.string().min(1)).min(1).optional(),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const ExtensionCatalog = z.array(CatalogEntry);
export type ExtensionCatalog = z.infer<typeof ExtensionCatalog>;
