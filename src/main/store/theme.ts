import { z } from 'zod'
import { themeJsonPath } from '../paths'
import { readJsonFile, writeJsonFile } from './jsonFile'

const ThemeStoreFile = z.object({ templateId: z.string().nullable() })
type ThemeStoreFile = z.infer<typeof ThemeStoreFile>

const EMPTY_STORE: ThemeStoreFile = { templateId: null }

export async function getTemplateId(): Promise<string | null> {
  const store = await readJsonFile(themeJsonPath(), ThemeStoreFile, () => EMPTY_STORE)
  return store.templateId
}

export async function setTemplateId(templateId: string | null): Promise<string | null> {
  await writeJsonFile(themeJsonPath(), { templateId })
  return templateId
}
