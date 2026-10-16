const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:']);

export function isAllowedExternalUrl(url: string): boolean {
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}
