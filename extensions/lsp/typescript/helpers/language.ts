const TS_EXTENSIONS = /\.(tsx?|mts|cts|jsx?|mjs|cjs)$/;

export function matches(filePath: string): boolean {
  return TS_EXTENSIONS.test(filePath);
}

export function languageId(filePath: string): string {
  if (filePath.endsWith('.tsx')) return 'typescriptreact';
  if (filePath.endsWith('.jsx')) return 'javascriptreact';
  if (/\.(mjs|cjs|js)$/.test(filePath)) return 'javascript';
  return 'typescript';
}

export function warmupFile(files: string[]): string | undefined {
  return files.find((f) => TS_EXTENSIONS.test(f) && !f.endsWith('.d.ts'));
}
