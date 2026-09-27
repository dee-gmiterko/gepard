import { z } from 'zod'

export const ExtensionSource = z.enum(['builtin', 'external'])
export type ExtensionSource = z.infer<typeof ExtensionSource>

export const ExtensionInfo = z.object({
  id: z.string(),
  displayName: z.string(),
  source: ExtensionSource,
  enabled: z.boolean(),
  error: z.string().optional()
})
export type ExtensionInfo = z.infer<typeof ExtensionInfo>
