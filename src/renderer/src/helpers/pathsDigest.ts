export function digestPaths(paths: readonly string[]): string {
  let fnv = 0x811c9dc5;
  let djb = 5381;
  for (const path of paths) {
    for (let i = 0; i < path.length; i++) {
      const code = path.charCodeAt(i);
      fnv = Math.imul(fnv ^ code, 0x01000193);
      djb = (Math.imul(djb, 33) + code) | 0;
    }
    fnv = Math.imul(fnv ^ 0x2f, 0x01000193);
    djb = (Math.imul(djb, 33) + 0x2f) | 0;
  }
  return `${paths.length}:${(fnv >>> 0).toString(16)}:${(djb >>> 0).toString(16)}`;
}
