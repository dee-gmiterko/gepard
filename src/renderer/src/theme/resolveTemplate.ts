import type { ThemeTemplate } from './tokens'
import { findTemplate } from './templates'

export const SYSTEM_LIGHT_TEMPLATE_ID = 'light'
export const SYSTEM_DARK_TEMPLATE_ID = 'dark'

export function resolveTemplate(
  selectedId: string | null,
  systemPrefersDark: boolean
): ThemeTemplate {
  if (selectedId !== null) {
    const selected = findTemplate(selectedId)
    if (selected) return selected
  }
  const fallbackId = systemPrefersDark ? SYSTEM_DARK_TEMPLATE_ID : SYSTEM_LIGHT_TEMPLATE_ID
  const fallback = findTemplate(fallbackId)
  if (!fallback) {
    throw new Error(`theme: built-in template "${fallbackId}" is missing from the registry`)
  }
  return fallback
}
