import { z } from 'zod';

export const ExtensionSource = z.enum(['builtin', 'external']);
export type ExtensionSource = z.infer<typeof ExtensionSource>;

export const ExtensionKind = z.enum(['lsp', 'grammar', 'theme', 'locale']);
export type ExtensionKind = z.infer<typeof ExtensionKind>;

export const ExtensionInfo = z.object({
  id: z.string(),
  displayName: z.string(),
  kind: ExtensionKind,
  source: ExtensionSource,
  enabled: z.boolean(),
  error: z.string().optional(),
  packageName: z.string().optional(),
  version: z.string().optional(),
});
export type ExtensionInfo = z.infer<typeof ExtensionInfo>;

export const CatalogEntryStatus = z.object({
  name: z.string(),
  displayName: z.string(),
  kind: ExtensionKind,
  description: z.string(),
  repository: z.string(),
  path: z.string(),
  latestVersion: z.string(),
  supported: z.boolean(),
  installedVersion: z.string().nullable(),
  installedSource: ExtensionSource.nullable(),
  updateAvailable: z.boolean(),
});
export type CatalogEntryStatus = z.infer<typeof CatalogEntryStatus>;

export const CatalogSource = z.enum(['remote', 'builtin']);
export type CatalogSource = z.infer<typeof CatalogSource>;

export const ExtensionCatalogStatus = z.object({
  source: CatalogSource,
  entries: z.array(CatalogEntryStatus),
});
export type ExtensionCatalogStatus = z.infer<typeof ExtensionCatalogStatus>;
