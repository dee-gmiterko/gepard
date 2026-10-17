export function formatLineReference(target: { path: string; line: number }): string {
  return `${target.path}:${target.line}`;
}
