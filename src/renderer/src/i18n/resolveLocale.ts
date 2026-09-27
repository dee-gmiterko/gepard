export function resolveLocale(
  available: readonly string[],
  preferred: readonly string[],
  defaultLocale: string
): string {
  for (const tag of preferred) {
    const normalized = tag.toLowerCase()
    const exact = available.find((candidate) => candidate.toLowerCase() === normalized)
    if (exact) return exact

    const base = normalized.split('-')[0]
    const baseMatch = available.find((candidate) => candidate.toLowerCase() === base)
    if (baseMatch) return baseMatch
  }

  if (available.some((candidate) => candidate.toLowerCase() === defaultLocale.toLowerCase())) {
    return defaultLocale
  }
  return available[0] ?? defaultLocale
}
