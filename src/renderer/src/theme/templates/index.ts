import type { ThemeTemplate } from '../tokens'
import { lightTemplate } from './light'
import { darkTemplate } from './dark'

export type { ThemeTemplate }

export const themeTemplates: ThemeTemplate[] = [lightTemplate, darkTemplate]

export function findTemplate(id: string): ThemeTemplate | undefined {
  return themeTemplates.find((template) => template.id === id)
}
