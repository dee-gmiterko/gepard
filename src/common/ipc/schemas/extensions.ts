import { z } from 'zod';

export const GitHubReleaseSource = z.object({
  kind: z.literal('github-release'),
  repository: z.string().min(1),
  path: z.string().nullable().default(null),
});
export type GitHubReleaseSource = z.infer<typeof GitHubReleaseSource>;

export const ExtensionSource = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('builtin') }),
  z.object({ kind: z.literal('local') }),
  GitHubReleaseSource,
]);
export type ExtensionSource = z.infer<typeof ExtensionSource>;

export const ExtensionInstallSource = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local'), dialogTitle: z.string().min(1) }),
  GitHubReleaseSource,
]);
export type ExtensionInstallSource = z.infer<typeof ExtensionInstallSource>;

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
  sha: z.string(),
  supported: z.boolean(),
  installedVersion: z.string().nullable(),
  installedSource: ExtensionSource.nullable(),
});
export type CatalogEntryStatus = z.infer<typeof CatalogEntryStatus>;

export const ExtensionCatalogStatus = z.object({
  entries: z.array(CatalogEntryStatus),
});
export type ExtensionCatalogStatus = z.infer<typeof ExtensionCatalogStatus>;
