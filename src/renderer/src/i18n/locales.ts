const modules = import.meta.glob('../locales/*.json', { eager: true }) as Record<
  string,
  { default: Record<string, string> }
>

function localeFromPath(path: string): string {
  const match = /([^/]+)\.json$/.exec(path)
  return match ? match[1] : path
}

export const messagesByLocale: Record<string, Record<string, string>> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [localeFromPath(path), mod.default])
)

export const availableLocales = Object.keys(messagesByLocale).sort()

export const defaultLocale = 'en'
